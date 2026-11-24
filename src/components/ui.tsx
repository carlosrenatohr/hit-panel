import { AlertTriangle, Biohazard, CheckCircle2, Clock, Loader2, X } from 'lucide-preact'
import type { LucideIcon } from 'lucide-preact'
import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
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

type BtnProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }
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
}: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
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

/** Hover/focus hint. The bubble is `position: fixed` and clamped to the viewport:
 *  an absolutely positioned bubble inside a scroll container (the package table,
 *  invoice rows, modals) pushed scrollWidth and got clipped, so the text stayed
 *  hidden and the page flickered as it opened. `align`/`placement` still only
 *  pick the preferred side; the clamp wins at the edges. */
export function Tooltip({
  text,
  children,
  align = 'center',
  placement = 'top',
}: {
  text: string
  children: ComponentChildren
  align?: 'start' | 'center' | 'end'
  placement?: 'top' | 'bottom'
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const place = () => {
    const anchor = anchorRef.current?.getBoundingClientRect()
    if (!anchor || typeof window === 'undefined') return
    const bubble = bubbleRef.current?.getBoundingClientRect()
    const width = bubble?.width ?? 0
    const height = bubble?.height ?? 0
    const gap = 6
    const margin = 8
    const preferred =
      align === 'start' ? anchor.left : align === 'end' ? anchor.right - width : anchor.left + anchor.width / 2 - width / 2
    const left = Math.min(Math.max(margin, preferred), Math.max(margin, window.innerWidth - width - margin))
    let top = placement === 'bottom' ? anchor.bottom + gap : anchor.top - height - gap
    // Flip below when the bubble would leave the viewport at the top.
    if (top < margin) top = anchor.bottom + gap
    setCoords({ top, left })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onScrollOrResize = () => place()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, text, align, placement])

  const show = () => {
    setOpen(true)
    place()
  }
  const hide = (e?: JSX.TargetedFocusEvent<HTMLSpanElement>) => {
    const next = e?.relatedTarget as Node | null
    if (next && anchorRef.current?.contains(next)) return
    setOpen(false)
  }

  return (
    <span
      ref={anchorRef}
      class="inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocusIn={show}
      onFocusOut={hide}
    >
      {children}
      <span
        ref={bubbleRef}
        role="tooltip"
        style={{ top: `${coords?.top ?? 0}px`, left: `${coords?.left ?? 0}px` }}
        class={`pointer-events-none fixed z-50 w-max max-w-[min(14rem,calc(100vw-2rem))] whitespace-normal rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-lg transition-opacity duration-100 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        {text}
      </span>
    </span>
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
      class="inline-flex items-center gap-0.5 rounded-full bg-navy/10 px-1.5 py-0.5 text-[11px] font-medium text-navy"
    >
      <Clock class="h-3 w-3" aria-hidden="true" /> {days}d
    </span>
  )
}

export interface SegmentedTab {
  key: string
  label: string
  icon?: LucideIcon
  /** Per-tab active classes (overrides default primary). Used by Customers status tabs. */
  activeCls?: string
}

/**
 * Unified segmented tab selector. Inline-flex (hugs content, never full-width),
 * joined pill container. Use `activeCls` per tab for semantic colors (Customers),
 * or leave it for the default primary orange (transport, filters).
 */
export function SegmentedTabs({
  tabs,
  value,
  onChange,
  size = 'md',
}: {
  tabs: SegmentedTab[]
  value: string
  onChange: (key: string) => void
  size?: 'sm' | 'md'
}) {
  const sizeCls = size === 'sm'
    ? 'gap-1 rounded-lg border border-gray-200 bg-white p-0.5'
    : 'gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5'
  const btnCls = size === 'sm'
    ? 'px-2.5 py-1 text-xs'
    : 'px-3 py-1.5 text-xs'
  const iconCls = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  return (
    <div class={`inline-flex flex-wrap items-center ${sizeCls}`}>
      {tabs.map((t) => {
        const Icon = t.icon
        const active = value === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={active}
            class={`inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${btnCls} ${
              active
                ? (t.activeCls ?? 'border border-primary bg-primary/10 text-primary')
                : 'border border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            {Icon && <Icon class={iconCls} aria-hidden="true" />}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export const inputCls =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary'

// ── Shared overlay (backlog P4-16) ─────────────────────────────────────────────
// One Modal used by Clientes and Configuración; closes on Escape or backdrop
// click, has role=dialog + aria-modal, and scrolls on mobile.

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ComponentChildren
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div class={`w-full ${widths[size]} max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl`}>
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-secondary">{title}</h2>
          <button type="button" class="text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Cerrar">
            <X class="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Bottom sheet overlay — same contract as Modal (Escape, backdrop, aria), anchored to the
 *  bottom edge for the mobile filter flow. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  fullscreen = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ComponentChildren
  /** Cover the whole viewport (used by the mobile status selector) instead of a bottom drawer. */
  fullscreen?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        class={
          fullscreen
            ? 'flex h-dvh w-full flex-col bg-white px-5 pb-6 pt-3 shadow-xl'
            : 'max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white px-5 pb-6 pt-3 shadow-xl'
        }
      >
        {!fullscreen && <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" aria-hidden="true" />}
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-secondary">{title}</h2>
          <button type="button" class="text-gray-400 hover:text-gray-700" onClick={onClose} aria-label="Cerrar">
            <X class="h-4 w-4" />
          </button>
        </div>
        {fullscreen ? <div class="flex-1 overflow-y-auto">{children}</div> : children}
      </div>
    </div>
  )
}

/** Floating, self-dismissing confirmation. The belt-and-suspenders feedback for
 *  audited actions: prominent on purpose, but never blocks the next click. */
export function Toast({
  open,
  onClose,
  title,
  message,
  tone = 'success',
  duration = 4500,
}: {
  open: boolean
  onClose: () => void
  title: string
  message?: string
  tone?: 'success' | 'error'
  /** Auto-dismiss delay in ms. */
  duration?: number
}) {
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [open, title, message, duration, onClose])

  if (!open) return null
  const tones = {
    success: {
      box: 'border-emerald-200 bg-white',
      icon: 'bg-emerald-100 text-emerald-600',
      title: 'text-emerald-900',
      body: 'text-emerald-800/80',
    },
    error: {
      box: 'border-red-200 bg-white',
      icon: 'bg-red-100 text-red-600',
      title: 'text-red-900',
      body: 'text-red-800/80',
    },
  }[tone]
  return (
    <div class="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4 print:hidden">
      <div
        role="status"
        aria-live="polite"
        class={`toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl ${tones.box}`}
      >
        <span class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tones.icon}`} aria-hidden="true">
          {tone === 'success' ? <CheckCircle2 class="h-5 w-5" /> : <AlertTriangle class="h-5 w-5" />}
        </span>
        <div class="min-w-0 flex-1">
          <div class={`text-sm font-semibold ${tones.title}`}>{title}</div>
          {message && <div class={`mt-0.5 text-xs leading-snug ${tones.body}`}>{message}</div>}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar aviso" class="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/** Blocking alert for rules that must stop the flow (e.g. mixing billing kinds).
 *  Deliberately louder than an inline banner: emoji, tinted icon and one action. */
export function AlertDialog({
  open,
  onClose,
  title,
  children,
  tone = 'danger',
  label = 'Entendido',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ComponentChildren
  tone?: 'danger' | 'warning' | 'info' | 'success'
  label?: string
}) {
  if (!open) return null
  const tones = {
    danger: { emoji: '⛔', circle: 'bg-red-50 text-red-600 ring-red-100', title: 'text-red-900', body: 'text-red-800/90' },
    warning: { emoji: '⚠️', circle: 'bg-amber-50 text-amber-600 ring-amber-100', title: 'text-amber-900', body: 'text-amber-800/90' },
    info: { emoji: 'ℹ️', circle: 'bg-sky-50 text-sky-600 ring-sky-100', title: 'text-sky-900', body: 'text-sky-800/90' },
    success: { emoji: '✅', circle: 'bg-emerald-50 text-emerald-600 ring-emerald-100', title: 'text-emerald-900', body: 'text-emerald-800/90' },
  }[tone]
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div class={`flex items-start gap-3 rounded-xl ring-1 ring-inset p-3 ${tones.circle}`}>
        <span class="text-2xl leading-none" aria-hidden="true">
          {tones.emoji}
        </span>
        <div class={`min-w-0 flex-1 text-sm leading-snug ${tones.body}`}>{children}</div>
      </div>
      <div class="mt-5 flex justify-end">
        <Button onClick={onClose}>{label}</Button>
      </div>
    </Modal>
  )
}

/** Confirmation overlay for destructive/audited actions (replaces window.confirm). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  variant = 'danger',
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** Text or rich content (lists, counts) rendered inside the dialog. */
  message: ComponentChildren
  confirmLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p class="text-sm text-gray-600">{message}</p>
      <div class="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
          {loading ? 'Guardando…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
