import { Eye, EyeOff } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { signIn } from '../lib/insforge'
import ForgotPassword from './ForgotPassword'
import { Button, Field, inputCls } from './ui'

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (forgot) {
    return (
      <ForgotPassword
        email={email}
        onDone={(e) => {
          setEmail(e)
          setForgot(false)
          setErr(null)
          setNotice('Contraseña actualizada. Iniciá sesión con la nueva.')
        }}
        onCancel={() => setForgot(false)}
      />
    )
  }

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await signIn(email.trim(), password)
      onSignedIn()
    } catch (e2) {
      setErr('Credenciales inválidas o cuenta sin acceso al panel.')
      setBusy(false)
    }
  }

  return (
    <div class="flex min-h-screen flex-col items-center justify-center gap-5 bg-gradient-to-br from-navy via-navy to-secondary px-4">
      <form onSubmit={submit} class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
        <div class="mb-6 text-center">
          <img src="/orbit-logo-version-finalv2.png" alt="Orbit" class="mx-auto mb-2 h-16 w-auto object-contain" />
          <p class="mt-1 text-sm text-gray-500">Orbit — plataforma logística</p>
        </div>
        <div class="flex flex-col gap-4">
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
          <Field label="Contraseña">
            <div class="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                class={`${inputCls} w-full pr-10`}
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                autocomplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
                class="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition-colors hover:text-primary"
              >
                {showPw ? <EyeOff class="h-4 w-4" aria-hidden="true" /> : <Eye class="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </Field>
          {notice && <p class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
          {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <Button type="submit" disabled={busy} class="w-full">
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setErr(null)
              setNotice(null)
              setForgot(true)
            }}
            class="text-center text-sm text-gray-500 hover:text-secondary"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </form>
      <p class="text-xs font-medium tracking-wide text-white/50">ORBIT · Envíos que conectan.</p>
    </div>
  )
}
