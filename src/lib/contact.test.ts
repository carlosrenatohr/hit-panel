import { describe, expect, it, vi } from 'vitest'
import { CONTACT_TO_DEFAULT, handleContactRequest } from './contact'
import type { ContactEnv } from './contact'

// Cada test usa IP única para no interferir con el rate limit (módulo privado).
let ipCounter = 0

function post(body: unknown, opts: { ip?: string; type?: string } = {}): Request {
  ipCounter += 1
  const headers: Record<string, string> = {
    'content-type': opts.type ?? 'application/json',
    'cf-connecting-ip': opts.ip ?? `10.0.0.${ipCounter}`,
  }
  return new Request('https://example.test/api/contact', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function validPayload(over: Record<string, unknown> = {}) {
  return {
    name: 'Ana Pérez',
    email: 'ana@example.com',
    topic: 'Soporte del panel',
    message: 'No puedo ver la guía 12345.',
    ...over,
  }
}

function mockEnv(over: Partial<ContactEnv> = {}): ContactEnv {
  return {
    EMAIL: { send: vi.fn().mockResolvedValue({ messageId: 'msg_1' }) },
    CONTACT_FROM: 'hola@orbit.example',
    CONTACT_FROM_NAME: 'Orbit',
    ...over,
  }
}

// Acceso tipado a las llamadas del send mockeado (evita que tsc exija `.mock`
// en la firma real de `ContactEmail.send`).
interface SentMessage {
  to: string
  from: { email: string; name?: string }
  replyTo: string
  subject: string
  text: string
  html: string
}
function sendCalls(env: ContactEnv): Array<[SentMessage]> {
  const send = env.EMAIL!.send as unknown as { mock: { calls: unknown[] } }
  return send.mock.calls as Array<[SentMessage]>
}

describe('handleContactRequest', () => {
  it('rechaza métodos que no sean POST', async () => {
    const req = new Request('https://example.test/api/contact', { method: 'GET' })
    const res = await handleContactRequest(req, mockEnv())
    expect(res.status).toBe(405)
  })

  it('rechaza content-type que no sea JSON', async () => {
    const res = await handleContactRequest(
      post('a=1', { type: 'application/x-www-form-urlencoded' }),
      mockEnv(),
    )
    expect(res.status).toBe(415)
  })

  it('rechaza JSON inválido', async () => {
    const res = await handleContactRequest(post('{no es json'), mockEnv())
    expect(res.status).toBe(400)
  })

  it('valida campos obligatorios y correo', async () => {
    const res = await handleContactRequest(post(validPayload({ email: 'no-es-correo' })), mockEnv())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('validation')
    expect(body.fields.email).toBe('invalid')
  })

  it('exige nombre y mensaje', async () => {
    const res = await handleContactRequest(post(validPayload({ name: '', message: '' })), mockEnv())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.fields.name).toBe('required')
    expect(body.fields.message).toBe('required')
  })

  it('el honeypot descarta spam sin procesar (éxito simulado)', async () => {
    const env = mockEnv()
    const res = await handleContactRequest(post(validPayload({ website: 'bot' })), env)
    expect(res.status).toBe(200)
    expect(env.EMAIL!.send).not.toHaveBeenCalled()
  })

  it('responde 503 (no disponible) si falta el binding o el remitente', async () => {
    // Sin EMAIL
    let res = await handleContactRequest(post(validPayload()), { CONTACT_FROM: 'x@y.z' })
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('unavailable')

    // Sin CONTACT_FROM (nunca inventar un From)
    res = await handleContactRequest(post(validPayload()), {
      EMAIL: { send: vi.fn() },
    })
    expect(res.status).toBe(503)
  })

  it('envía al destino fijo con Reply-To del visitante', async () => {
    const env = mockEnv()
    const res = await handleContactRequest(post(validPayload()), env)
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)

    const sent = sendCalls(env)[0][0]
    expect(sent.to).toBe(CONTACT_TO_DEFAULT)
    expect(sent.from.email).toBe('hola@orbit.example')
    expect(sent.replyTo).toBe('ana@example.com')
    expect(sent.subject).toContain('Soporte del panel')
    expect(sent.subject).toContain('Ana Pérez')
    expect(sent.text).toContain('No puedo ver la guía 12345.')
  })

  it('usa CONTACT_TO cuando está configurado', async () => {
    const env = mockEnv({ CONTACT_TO: 'otro@destino.example' })
    await handleContactRequest(post(validPayload()), env)
    expect(sendCalls(env)[0][0].to).toBe('otro@destino.example')
  })

  it('responde 502 sin exponer el error si el proveedor falla', async () => {
    const env = mockEnv({ EMAIL: { send: vi.fn().mockRejectedValue(new Error('boom secreto')) } })
    const res = await handleContactRequest(post(validPayload()), env)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('send_failed')
    expect(JSON.stringify(body)).not.toContain('boom secreto')
  })

  it('limpia CRLF del asunto para evitar header injection', async () => {
    const env = mockEnv()
    const res = await handleContactRequest(
      post(validPayload({ name: 'Ana\r\nBcc: evil@x.com', topic: 'Hola\r\nX-Injected: 1' })),
      env,
    )
    expect(res.status).toBe(200)
    const sent = sendCalls(env)[0][0]
    // Sin CR/LF el asunto es una sola línea → no puede abrir un header nuevo.
    expect(sent.subject).not.toMatch(/[\r\n]/)
    expect(sent.subject.split('\n')).toHaveLength(1)
    // El texto inyectado queda colapsado como contenido literal, no como header.
    expect(sent.subject).toBe('[CONTACTO] Hola X-Injected: 1 — Ana Bcc: evil@x.com')
  })

  it('escapa HTML en los campos del usuario', async () => {
    const env = mockEnv()
    const res = await handleContactRequest(
      post(validPayload({ message: '<script>alert(1)</script>' })),
      env,
    )
    expect(res.status).toBe(200)
    const sent = sendCalls(env)[0][0]
    expect(sent.html).not.toContain('<script>')
    expect(sent.html).toContain('&lt;script&gt;')
  })

  it('aplica rate limit tras 5 envíos desde la misma IP', async () => {
    const ip = '172.16.9.9'
    const env = mockEnv()
    for (let i = 0; i < 5; i++) {
      const res = await handleContactRequest(post(validPayload(), { ip }), env)
      expect(res.status).toBe(200)
    }
    const blocked = await handleContactRequest(post(validPayload(), { ip }), env)
    expect(blocked.status).toBe(429)
  })
})
