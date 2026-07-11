import { AlertTriangle, Biohazard, Clock, Loader2 } from 'lucide-preact'
import type { ComponentChildren, JSX } from 'preact'
import { useState } from 'preact/hooks'
import { STATUS_DOT, STATUS_LABEL, STATUS_SOFT } from '../lib/format'
import type { ShipmentStatus } from '../lib/types'

/** Click/hover badge with a short explainer popover — keyboard and mobile friendly (not just :hover). */
export function InfoTooltip({ text, children }: { text: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(false)
  return (
    <span class="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        class="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onBlur={() => setOpen(false)}
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          class="absolute left-1/2 top-full z-20 mt-1.5 w-52 -translate-x-1/2 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  )
}

const HAZMAT_EXPLAINER = 'Mercancía peligrosa (hazmat). Requiere manejo especial y puede tardar más en tránsito.'
export function HazmatBadge() {
  return (
    <InfoTooltip text={HAZMAT_EXPLAINER}>
      <span class="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-200">
        <Biohazard class="h-3 w-3" aria-hidden="true" /> Hazmat
      </span>
    </InfoTooltip>
  )
}

/** Compact colored dot + label — for dense table rows, doesn't compete for attention. */
export function StatusDot({ s, class: cls = '' }: { s?: ShipmentStatus | null; class?: string }) {
  const key = (s ?? 'desconocido') as ShipmentStatus
  return (
    <span class={`inline-flex items-center gap-1.5 text-sm text-gray-700 ${cls}`}>
      <span class={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[key] ?? STATUS_DOT.desconocido}`} />
      {STATUS_LABEL[key] ?? key}
    </span>
  )
}

/** Prominent soft badge — for the detail header and single-status emphasis. */
export function StatusPill({ s, class: cls = '' }: { s?: ShipmentStatus | null; class?: string }) {
  const key = (s ?? 'desconocido') as ShipmentStatus
  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_SOFT[key] ?? STATUS_SOFT.desconocido} ${cls}`}
    >
      <span class={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[key] ?? STATUS_DOT.desconocido}`} />
      {STATUS_LABEL[key] ?? key}
    </span>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div class="flex items-center gap-2 text-sm text-gray-500">
      <Loader2 class="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
      {label ?? 'Cargando…'}
    </div>
  )
}

export function Card({
  children,
  class: cls = '',
  accent = false,
}: {
  children: ComponentChildren
  class?: string
  accent?: boolean
}) {
  return (
    <div class={`rounded-xl bg-white shadow-sm ${accent ? 'border border-primary/10' : 'border border-gray-100'} ${cls}`}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) {
  return (
    <div class={`flex items-center gap-2 border-b border-gray-100 px-5 py-3 text-sm font-semibold text-secondary ${cls}`}>
      {children}
    </div>
  )
}

// Preact's JSX.HTMLAttributes (now deprecated) doesn't surface `disabled`/`type` for
// buttons, so declare them explicitly — otherwise every `<Button disabled>` fails typecheck.
type BtnProps = JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}
export function Button({ variant = 'primary', class: cls = '', children, ...rest }: BtnProps) {
  const styles: Record<string, string> = {
    primary: 'bg-primary text-white shadow-sm hover:bg-primary-dark hover:shadow',
    ghost: 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 hover:text-gray-900',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      class={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${cls}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  class: cls = '',
  children,
  ...rest
}: JSX.HTMLAttributes<HTMLButtonElement> & { label: string; disabled?: boolean; type?: 'button' | 'submit' | 'reset' }) {
  return (
    <button
      aria-label={label}
      title={label}
      class={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${cls}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class="flex flex-col gap-1 text-xs font-medium text-gray-500">
      {label}
      {children}
    </label>
  )
}

export function Chip({ children, class: cls = '' }: { children: ComponentChildren; class?: string }) {
  return (
    <span class={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{children}</span>
  )
}

/** Red warning: days since the LAST tracking event — flags a package that hasn't moved. */
export function StaleBadge({ days }: { days: number }) {
  return (
    <span
      title={`${days} días sin actualización desde el último evento`}
      class="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-600"
    >
      <AlertTriangle class="h-3 w-3" aria-hidden="true" /> {days}d
    </span>
  )
}

/** Neutral info: days elapsed since the package was received in the Miami warehouse. */
export function DaysBadge({ days }: { days: number }) {
  return (
    <span
      title={`${days} días desde la recepción en Miami`}
      class="inline-flex items-center gap-0.5 rounded-full bg-accent-blue/10 px-1.5 py-0.5 text-[11px] font-medium text-accent-blue"
    >
      <Clock class="h-3 w-3" aria-hidden="true" /> {days}d
    </span>
  )
}

export const inputCls =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary'
