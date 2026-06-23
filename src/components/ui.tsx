import type { ComponentChildren, JSX } from 'preact'
import { STATUS_LABEL, STATUS_STYLE } from '../lib/format'
import type { ShipmentStatus } from '../lib/types'

export function StatusPill({ s }: { s?: ShipmentStatus | null }) {
  const key = (s ?? 'desconocido') as ShipmentStatus
  return (
    <span
      class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLE[key] ?? STATUS_STYLE.desconocido
      }`}
    >
      {STATUS_LABEL[key] ?? key}
    </span>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div class="flex items-center gap-2 text-sm text-slate-500">
      <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
      {label ?? 'Cargando…'}
    </div>
  )
}

export function Card({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) {
  return <div class={`rounded-xl border border-slate-200 bg-white shadow-sm ${cls}`}>{children}</div>
}

type BtnProps = JSX.HTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }
export function Button({ variant = 'primary', class: cls = '', children, ...rest }: BtnProps) {
  const styles: Record<string, string> = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    ghost: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      class={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${styles[variant]} ${cls}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
      {label}
      {children}
    </label>
  )
}

export const inputCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary'
