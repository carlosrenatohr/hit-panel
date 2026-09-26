import { useEffect, useState } from 'preact/hooks'
import { Layers } from 'lucide-preact'
import { STATUS_LABEL, STATUS_ORDER, STATUS_SOFT } from '../../lib/format'
import type { ShipmentStatus } from '../../lib/types'
import { BottomSheet, Button } from '../ui'
import { STATUS_ICON } from './LifecycleOverview'

/**
 * Full-screen status list: the ONE mobile entry point that proposes a value in a
 * draft until "Aplicar filtro" writes it through `onApply`. Covers the whole
 * viewport (BottomSheet fullscreen) listing every canonical status with its
 * count, so applying never disturbs the other active filters (transport,
 * provider, period). Only reachable from the mobile primary status selector.
 */
export default function FilterSheet({
  open,
  onClose,
  counts,
  total,
  loading,
  activeStatus,
  onApply,
}: {
  open: boolean
  onClose: () => void
  counts: Partial<Record<ShipmentStatus, number>>
  /** Count with no status predicate — the "Todos" row. */
  total?: number
  loading: boolean
  activeStatus?: ShipmentStatus
  onApply: (s: ShipmentStatus | undefined) => void
}) {
  const [draft, setDraft] = useState<ShipmentStatus | undefined>(activeStatus)
  // Re-seed from the applied filter each time the sheet opens, never while it's open.
  useEffect(() => {
    if (open) setDraft(activeStatus)
  }, [open, activeStatus])

  const rows: { key: string; label: string; status?: ShipmentStatus; count?: number }[] = [
    { key: 'todos', label: 'Todos', count: total },
    ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABEL[s], status: s, count: counts[s] })),
  ]

  return (
    <BottomSheet open={open} onClose={onClose} title="Filtrar órdenes" fullscreen>
      <div role="radiogroup" aria-label="Filtrar por estado" class="space-y-1">
        {rows.map((r) => {
          const selected = draft === r.status
          const Icon = r.status ? STATUS_ICON[r.status] : Layers
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setDraft(r.status)}
              class="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span
                class={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-primary' : 'border-gray-300'
                }`}
                aria-hidden="true"
              >
                {selected && <span class="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
              <span
                class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  r.status ? STATUS_SOFT[r.status] : 'bg-gray-100 text-gray-500'
                }`}
                aria-hidden="true"
              >
                <Icon class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-700">
                {r.label}
              </span>
              <span class="shrink-0 text-sm font-medium tabular-nums text-gray-400">
                {loading ? <span class="inline-block h-4 w-6 animate-pulse rounded bg-gray-100" /> : r.count ?? 0}
              </span>
            </button>
          )
        })}
      </div>
      <div class="mt-5">
        <Button
          variant="primary"
          class="w-full"
          onClick={() => {
            onApply(draft)
            onClose()
          }}
        >
          Aplicar filtro
        </Button>
      </div>
    </BottomSheet>
  )
}
