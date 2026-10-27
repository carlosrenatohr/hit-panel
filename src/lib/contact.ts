// ─── Endpoint de contacto (lógica pura) ────────────────────────────────────
// Fuera de `functions/` para poder unit-testearla con un `env` mockeado. El
// wrapper de Pages Functions (`functions/api/contact.ts`) solo adapta Request/Env.
//
// Diseño (ver plan §Fase 4):
//  - El navegador SOLO hace POST a /api/contact; nunca ve el destino ni llama a
//    un proveedor de correo. El destinatario (`To`) vive fijo en el servidor.
//  - Remitente (`From`) sale de un env configurado; si no existe, NO se envía
//    (503) — nunca se inventa un `From` ni se finge un éxito.
//  - `Reply-To` = email validado del visitante (para poder responderle).
//  - Validación server-side, honeypot anti-spam y rate limit best-effort.

export interface ContactEmail {
  send(message: Record<string, unknown>): Promise<{ messageId?: string }>
}

export interface ContactEnv {
  /** Binding `send_email` de Cloudflare Email Service. Falta → no se envía. */
  EMAIL?: ContactEmail
  /** Remitente verificado en un dominio habilitado (p. ej. hola@tudominio.com). */
  CONTACT_FROM?: string
  /** Nombre del remitente. */
  CONTACT_FROM_NAME?: string
  /** Destino fijo. Por defecto el correo oficial del equipo. */
  CONTACT_TO?: string
}

export interface ContactPayload {
  name?: string
  email?: string
  company?: string
  topic?: string
  message?: string
  /** Honeypot: debe venir vacío. Si se llena, es spam. */
  website?: string
}

export const CONTACT_TO_DEFAULT = 'orbit.system.ni@gmail.com'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX = { name: 120, email: 254, company: 120, topic: 120, message: 5000 }
const MAX_BODY_BYTES = 32 * 1024

// Rate limit best-effort por IP (ventana fija). En serverless es por aislamiento:
// reduce abuso, no es una garantía. Ante spam real se recomienda Turnstile.
const WINDOW_MS = 60_000
const MAX_HITS = 5
const hits = new Map<string, { count: number; reset: number }>()

function rateLimited(ip: string, now: number): boolean {
  const entry = hits.get(ip)
  if (!entry || now >= entry.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_HITS
}

/** Escapa HTML para inyectar valores del usuario en la plantilla del correo. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Elimina CR/LF para evitar header injection en asunto/campos. */
function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export async function handleContactRequest(request: Request, env: ContactEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405)
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return json({ ok: false, error: 'unsupported_media_type' }, 415)
  }

  // Tamaño del cuerpo.
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'payload_too_large' }, 413)
  }

  let payload: ContactPayload
  try {
    payload = JSON.parse(raw) as ContactPayload
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400)
  }

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'local'
  if (rateLimited(ip, Date.now())) {
    return json({ ok: false, error: 'rate_limited' }, 429)
  }

  // Honeypot: campo oculto que un humano deja vacío. Respondemos éxito para no
  // delatar el filtro, pero no procesamos nada.
  if (payload.website && payload.website.trim() !== '') {
    return json({ ok: true }, 200)
  }

  const name = clean(String(payload.name ?? ''))
  const email = clean(String(payload.email ?? ''))
  const company = clean(String(payload.company ?? '')).slice(0, MAX.company)
  const topic = clean(String(payload.topic ?? '')).slice(0, MAX.topic)
  const message = String(payload.message ?? '').trim()

  const fields: Record<string, string> = {}
  if (!name || name.length > MAX.name) fields.name = 'required'
  if (!EMAIL_RE.test(email) || email.length > MAX.email) fields.email = 'invalid'
  if (!message || message.length > MAX.message) fields.message = 'required'
  if (Object.keys(fields).length > 0) {
    return json({ ok: false, error: 'validation', fields }, 400)
  }

  // Remitente/binding: sin configurar no hay envío real. Nunca inventar From.
  const from = env.CONTACT_FROM
  const to = env.CONTACT_TO || CONTACT_TO_DEFAULT
  if (!env.EMAIL || !from) {
    return json({ ok: false, error: 'unavailable' }, 503)
  }

  const subject = clean(`[CONTACTO] ${topic || 'Consulta general'} — ${name}`)
  const text = [
    `Nombre: ${name}`,
    `Email: ${email}`,
    company ? `Empresa: ${company}` : null,
    `Asunto: ${topic || 'Consulta general'}`,
    '',
    message,
  ]
    .filter(Boolean)
    .join('\n')

  const html = [
    `<p><strong>Nombre:</strong> ${esc(name)}</p>`,
    `<p><strong>Email:</strong> ${esc(email)}</p>`,
    company ? `<p><strong>Empresa:</strong> ${esc(company)}</p>` : null,
    `<p><strong>Asunto:</strong> ${esc(topic || 'Consulta general')}</p>`,
    `<hr/><p>${esc(message).replace(/\n/g, '<br/>')}</p>`,
  ]
    .filter(Boolean)
    .join('')

  try {
    const result = await env.EMAIL.send({
      to,
      from: { email: from, name: env.CONTACT_FROM_NAME || 'Orbit' },
      replyTo: email,
      subject,
      text,
      html,
    })
    return json({ ok: true, messageId: result?.messageId }, 200)
  } catch {
    // No exponer el error del proveedor al cliente.
    return json({ ok: false, error: 'send_failed' }, 502)
  }
}
