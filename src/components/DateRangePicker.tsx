import { Calendar, ChevronDown } from 'lucide-preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { inputCls } from './ui'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function addMonths(d: Date, n: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + n)
  return r
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

interface Preset {
  id: string
  label: string
  range: () => { from?: string; to?: string }
}

const PRESETS: Preset[] = [
  { id: '7d', label: 'Últimos 7 días', range: () => ({ from: ymd(addDays(new Date(), -6)), to: ymd(new Date()) }) },
  { id: '30d', label: 'Últimos 30 días', range: () => ({ from: ymd(addDays(new Date(), -29)), to: ymd(new Date()) }) },
  { id: 'month', label: 'Este mes', range: () => ({ from: ymd(startOfMonth(new Date())), to: ymd(new Date()) }) },
  {
    id: 'lastMonth',
    label: 'Mes pasado',
    range: () => {
      const prev = addMonths(new Date(), -1)
      return { from: ymd(startOfMonth(prev)), to: ymd(endOfMonth(prev)) }
    },
  },
  { id: '3m', label: 'Últimos 3 meses', range: () => ({ from: ymd(addMonths(new Date(), -3)), to: ymd(new Date()) }) },
  { id: '6m', label: 'Últimos 6 meses', range: () => ({ from: ymd(addMonths(new Date(), -6)), to: ymd(new Date()) }) },
  { id: 'all', label: 'Todo el tiempo', range: () => ({ from: undefined, to: undefined }) },
]

function matchPreset(from?: string, to?: string): Preset | undefined {
  return PRESETS.find((p) => {
    const r = p.range()
    return r.from === from && r.to === to
  })
}

function fmtShort(s: string): string {
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short' })
}

/**
 * Preset-driven date range picker (7/30 days, this/last month, 3/6 months, all time) with a
 * "Personalizado" fallback to the plain date inputs for anything else. No calendar-grid widget —
 * the presets cover the common cases and a custom range doesn't need one re-implemented.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from?: string
  to?: string
  onChange: (from?: string, to?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const active = matchPreset(from, to)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const label = active ? active.label : from || to ? `${from ? fmtShort(from) : '…'} – ${to ? fmtShort(to) : '…'}` : 'Todo el tiempo'

  return (
    <div class="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        class={`${inputCls} flex items-center gap-2 whitespace-nowrap`}
      >
        <Calendar class="h-4 w-4 text-gray-400" aria-hidden="true" />
        {label}
        <ChevronDown class="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
      </button>
      {open && (
        <div class="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
          <ul>
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    const r = p.range()
                    onChange(r.from, r.to)
                    setCustom(false)
                    setOpen(false)
                  }}
                  class={`w-full rounded-lg px-3 py-1.5 text-left text-sm ${
                    active?.id === p.id ? 'bg-primary/10 font-medium text-primary' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setCustom((c) => !c)}
                class={`w-full rounded-lg px-3 py-1.5 text-left text-sm ${
                  !active && (from || to) ? 'bg-primary/10 font-medium text-primary' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Personalizado…
              </button>
            </li>
          </ul>
          {custom && (
            <div class="grid grid-cols-2 gap-2 border-t border-gray-100 p-2 pt-3">
              <label class="flex flex-col gap-1 text-xs font-medium text-gray-500">
                Desde
                <input type="date" class={inputCls} value={from ?? ''} onChange={(e) => onChange((e.target as HTMLInputElement).value || undefined, to)} />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-gray-500">
                Hasta
                <input type="date" class={inputCls} value={to ?? ''} onChange={(e) => onChange(from, (e.target as HTMLInputElement).value || undefined)} />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
