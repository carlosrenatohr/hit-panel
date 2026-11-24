import { Layers } from 'lucide-preact'
import type { ComponentChildren } from 'preact'

export interface StatusFilterOption {
  value: string
  label: string
  /** Same Lucide icon the lifecycle cards use — one status vocabulary everywhere. */
  icon: typeof Layers
  /** Tailwind classes for the icon chip (STATUS_SOFT from lib/format). */
  tone: string
  count?: number
}

/**
 * Multi-select status chips — the compact variant of Paquetería's lifecycle
 * filters, shared by any module that filters by shipment status (Reports).
 * Toggling is instant and cumulative: no request per click, no dropdown.
 */
export function StatusFilterChips({
  options,
  selected,
  onChange,
  counts,
  loading = false,
  label = 'Filtrar por estado',
  children,
}: {
  options: StatusFilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  /** Optional live counts keyed by status value. */
  counts?: Record<string, number>
  loading?: boolean
  label?: string
  /** Extra controls rendered at the end of the row (kept on one line). */
  children?: ComponentChildren
}) {
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }
  const all = selected.length === 0
  return (
    <div class="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={all}
        class={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          all ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
        }`}
      >
        <Layers class="h-3.5 w-3.5" aria-hidden="true" />
        Todos
      </button>
      {options.map((o) => {
        const active = selected.includes(o.value)
        const Icon = o.icon
        // With a counts map, every chip shows a number (0 included) so the row
        // reads consistently instead of some chips having a trailing digit.
        const count = counts ? (counts[o.value] ?? 0) : undefined
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={active}
            class={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <span class={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${o.tone}`} aria-hidden="true">
              <Icon class="h-3 w-3" />
            </span>
            {o.label}
            {count !== undefined && (
              <span class={`tabular-nums ${active ? 'text-primary' : 'text-gray-400'}`}>
                {loading ? <span class="inline-block h-2.5 w-5 animate-pulse rounded bg-gray-100" /> : count}
              </span>
            )}
          </button>
        )
      })}
      {children}
    </div>
  )
}
