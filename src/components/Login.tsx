import { Package } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { signIn } from '../lib/insforge'
import { Button, Field, inputCls } from './ui'

export default function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

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
    <div class="flex min-h-screen items-center justify-center bg-secondary px-4">
      <form onSubmit={submit} class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Package class="h-6 w-6 text-white" aria-hidden="true" />
          </div>
          <h1 class="text-xl font-bold tracking-tight text-secondary">HIT Cargo</h1>
          <p class="mt-1 text-sm text-gray-500">Panel interno del equipo</p>
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
            <input
              type="password"
              required
              class={inputCls}
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              autocomplete="current-password"
            />
          </Field>
          {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <Button type="submit" disabled={busy} class="w-full">
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
