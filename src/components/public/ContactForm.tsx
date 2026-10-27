import { useState } from 'preact/hooks'

// Formulario de contacto — publica en `POST /api/contact` (Pages Function).
// El navegador solo habla con el endpoint; nunca ve el destino ni un proveedor.
// Estados: idle → sending → success | error. Accesible (aria-live, labels, teclado).

type Status = 'idle' | 'sending' | 'success' | 'error'

const TOPICS = [
  'Solicitar una demostración',
  'Soporte del panel',
  'Consulta comercial',
  'Privacidad de datos',
  'Reportar un problema',
]

const messages: Record<string, string> = {
  unavailable: 'El formulario no está disponible en este momento. Inténtalo más tarde.',
  rate_limited: 'Demasiados envíos seguidos. Espera un momento y vuelve a intentarlo.',
  send_failed: 'No pudimos enviar tu mensaje. Inténtalo de nuevo en unos minutos.',
  network: 'Sin conexión al servidor. Revisa tu red e inténtalo de nuevo.',
}

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [showForm, setShowForm] = useState(true)

  async function onSubmit(e: Event) {
    e.preventDefault()
    if (status === 'sending') return

    const form = e.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      company: String(data.get('company') ?? ''),
      topic: String(data.get('topic') ?? ''),
      message: String(data.get('message') ?? ''),
      // honeypot
      website: String(data.get('website') ?? ''),
    }

    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        fields?: Record<string, string>
      }

      if (res.ok && body.ok) {
        setStatus('success')
        form.reset()
        return
      }

      setStatus('error')
      if (body.error === 'validation') {
        const first = body.fields ? Object.values(body.fields)[0] : undefined
        setErrorMsg(
          first === 'invalid'
            ? 'Revisa tu correo electrónico.'
            : 'Completa los campos obligatorios.',
        )
      } else {
        setErrorMsg(messages[body.error ?? ''] ?? messages.network)
        // Sin endpoint disponible → oculta el form y ofrece alternativa.
        if (body.error === 'unavailable') setShowForm(false)
      }
    } catch {
      setStatus('error')
      setErrorMsg(messages.network)
    }
  }

  if (status === 'success') {
    return (
      <div
        class="rounded-xl border border-green-200 bg-green-50 p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <p class="font-display text-lg font-bold text-green-800">Mensaje enviado</p>
        <p class="mt-1 text-sm text-green-700">
          Gracias por escribirnos. Te responderemos pronto al correo que nos dejaste.
        </p>
        <button
          type="button"
          class="mt-4 text-sm font-medium text-green-800 underline underline-offset-2"
          onClick={() => {
            setStatus('idle')
            setErrorMsg('')
          }}
        >
          Enviar otro mensaje
        </button>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div
        class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <p class="font-display text-lg font-bold text-amber-800">Formulario no disponible</p>
        <p class="mt-1 text-sm text-amber-700">
          No podemos recibir mensajes en este momento. Puedes contactarnos desde el enlace del
          pie de página.
        </p>
      </div>
    )
  }

  const disabled = status === 'sending'

  return (
    <form onSubmit={onSubmit} noValidate class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="cf-name" class="block text-sm font-medium text-secondary">
            Nombre *
          </label>
          <input
            id="cf-name"
            name="name"
            type="text"
            required
            autocomplete="name"
            maxLength={120}
            disabled={disabled}
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label for="cf-email" class="block text-sm font-medium text-secondary">
            Correo electrónico *
          </label>
          <input
            id="cf-email"
            name="email"
            type="email"
            required
            autocomplete="email"
            maxLength={254}
            disabled={disabled}
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
          />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="cf-company" class="block text-sm font-medium text-secondary">
            Empresa <span class="text-neutral-text">(opcional)</span>
          </label>
          <input
            id="cf-company"
            name="company"
            type="text"
            autocomplete="organization"
            maxLength={120}
            disabled={disabled}
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
          />
        </div>
        <div>
          <label for="cf-topic" class="block text-sm font-medium text-secondary">
            Motivo
          </label>
          <select
            id="cf-topic"
            name="topic"
            disabled={disabled}
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
          >
            {TOPICS.map((t) => (
              <option value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label for="cf-message" class="block text-sm font-medium text-secondary">
          Mensaje *
        </label>
        <textarea
          id="cf-message"
          name="message"
          rows={5}
          required
          maxLength={5000}
          disabled={disabled}
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-slate-50"
        />
      </div>

      {/* Honeypot — oculto a los usuarios, los bots lo rellenan. */}
      <div class="hidden" aria-hidden="true">
        <label for="cf-website">No completar</label>
        <input id="cf-website" name="website" type="text" tabIndex={-1} autocomplete="off" />
      </div>

      <p class="text-xs text-neutral-text">
        Usamos estos datos únicamente para responder a tu consulta. No los compartimos con
        terceros ni los usamos para marketing.
      </p>

      {errorMsg && (
        <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {disabled && (
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden="true"
          />
        )}
        {disabled ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </form>
  )
}
