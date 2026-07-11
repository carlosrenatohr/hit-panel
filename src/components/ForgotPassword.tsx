import { ArrowLeft, Eye, EyeOff } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { completePasswordReset, sendPasswordReset } from '../lib/insforge'
import { Button, Field, inputCls } from './ui'

/**
 * Self-service password reset (InsForge `resetPasswordMethod: "code"`):
 *   1. enter email  → a 6-digit code is emailed
 *   2. enter the code + a new password → done
 * Requires SMTP to be enabled on the InsForge project so the email actually sends.
 */
export default function ForgotPassword({
  email: initialEmail,
  onDone,
  onCancel,
}: {
  email?: string
  onDone: (email: string) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function requestCode(e: Event) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await sendPasswordReset(email.trim())
      setStep('reset')
    } catch {
      setErr('No pudimos enviar el código. Verificá el correo e intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function reset(e: Event) {
    e.preventDefault()
    if (password.length < 6) {
      setErr('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await completePasswordReset(code.trim(), password)
      onDone(email.trim())
    } catch {
      setErr('El código es inválido o expiró. Pedí uno nuevo.')
      setBusy(false)
    }
  }

  return (
    <div class="flex min-h-screen flex-col items-center justify-center gap-5 bg-gradient-to-br from-navy via-navy to-secondary px-4">
      <form
        onSubmit={step === 'request' ? requestCode : reset}
        class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5"
      >
        <div class="mb-6 text-center">
          <img src="/logo-full.png" alt="HIT Cargo" class="mx-auto mb-2 h-16 w-auto object-contain" />
          <p class="mt-1 text-sm font-semibold text-secondary">Recuperar contraseña</p>
          <p class="mt-0.5 text-xs text-gray-500">
            {step === 'request'
              ? 'Te enviamos un código a tu correo.'
              : `Ingresá el código que enviamos a ${email}.`}
          </p>
        </div>

        <div class="flex flex-col gap-4">
          {step === 'request' ? (
            <Field label="Correo">
              <input
                type="email"
                required
                class={inputCls}
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                placeholder="tu@hit-cargo.com"
                autocomplete="username"
              />
            </Field>
          ) : (
            <>
              <Field label="Código de 6 dígitos">
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  class={inputCls}
                  value={code}
                  onInput={(e) => setCode((e.target as HTMLInputElement).value)}
                  placeholder="123456"
                  autocomplete="one-time-code"
                />
              </Field>
              <Field label="Nueva contraseña">
                <div class="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    class={`${inputCls} pr-10`}
                    value={password}
                    onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                    autocomplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    tabIndex={-1}
                    class="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff class="h-4 w-4" aria-hidden="true" /> : <Eye class="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </Field>
            </>
          )}

          {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

          <Button type="submit" disabled={busy} class="w-full">
            {busy ? 'Enviando…' : step === 'request' ? 'Enviar código' : 'Cambiar contraseña'}
          </Button>

          <button
            type="button"
            onClick={() => (step === 'reset' ? setStep('request') : onCancel())}
            class="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-secondary"
          >
            <ArrowLeft class="h-4 w-4" aria-hidden="true" />
            {step === 'reset' ? 'Cambiar correo' : 'Volver al inicio de sesión'}
          </button>
        </div>
      </form>
      <p class="text-xs font-medium tracking-wide text-white/50">HIT CARGO · Envíos que conectan.</p>
    </div>
  )
}
