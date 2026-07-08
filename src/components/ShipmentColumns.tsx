import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import {
  cleanName,
  daysAgo,
  fmtDate,
  isHazmat,
  officeFlag,
  providerLabel,
  SERVICE_EMOJI,
} from '../lib/format'
import type { Pkg, ShipmentStatus } from '../lib/types'
import { Button, HazmatBadge, IconButton, inputCls, StaleBadge, StatusDot } from './ui'
import { GripVertical, Lock, Search, SlidersHorizontal, X } from 'lucide-preact'

// Guía is always the first column (it's how a row opens) — everything below is user-configurable.
export interface ColumnDef {
  key: string
  label: string
  render: (p: Pkg) => JSX.Element | string
}

export const COLUMN_DEFS: ColumnDef[] = [
  {
    key: 'nombre',
    label: 'Nombre',
    render: (p) => (
      <div class="flex items-center gap-1.5">
        <span class="text-gray-700">{cleanName(p.referencia_name)}</span>
        {isHazmat(p.referencia_name) && <HazmatBadge />}
      </div>
    ),
  },
  {
    key: 'tracking',
    label: 'Tracking',
    render: (p) => <div class="max-w-[160px] truncate font-mono text-xs text-gray-500">{p.tracking_number ?? '—'}</div>,
  },
  { key: 'provider', label: 'Proveedor', render: (p) => <span class="text-gray-600">{providerLabel(p.providers?.code)}</span> },
  { key: 'status', label: 'Estado', render: (p) => <StatusDot s={p.effective_status as ShipmentStatus} /> },
  {
    key: 'service',
    label: 'Servicio',
    render: (p) => (
      <span title={p.service_type ?? undefined}>
        {p.service_type ? SERVICE_EMOJI[p.service_type] : '—'} {officeFlag(p.origin_office)}
      </span>
    ),
  },
  {
    key: 'carga',
    label: 'Carga',
    render: (p) => (
      <span class="text-gray-600">
        {p.pieces ?? '—'} pzs{p.weight_lb ? ` · ${p.weight_lb} lb` : ''}
      </span>
    ),
  },
  {
    key: 'ruta',
    label: 'Ruta',
    render: (p) => <span class="text-gray-600">{(p.origin_office ?? '—') + ' → ' + (p.dest_office ?? '—')}</span>,
  },
  {
    key: 'ultEvento',
    label: 'Últ. evento',
    render: (p) => {
      const stale = daysAgo(p.last_event_at)
      const showStale = stale !== null && stale > 10 && p.effective_status !== 'entregado'
      return (
        <div class="flex items-center gap-1.5 text-gray-600">
          {fmtDate(p.last_event_at)}
          {showStale && <StaleBadge days={stale as number} />}
        </div>
      )
    },
  },
]

const DEFAULT_HIDDEN = new Set(['tracking', 'ruta'])
const STORAGE_KEY = 'hit-panel:shipments:columns:v1'

interface ColState {
  key: string
  visible: boolean
}

function defaultColumns(): ColState[] {
  return COLUMN_DEFS.map((c) => ({ key: c.key, visible: !DEFAULT_HIDDEN.has(c.key) }))
}

function loadColumns(): ColState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultColumns()
    const saved = JSON.parse(raw) as ColState[]
    const knownKeys = new Set(COLUMN_DEFS.map((c) => c.key))
    const savedKeys = new Set(saved.map((c) => c.key))
    // Drop columns that no longer exist, append any new ones (visible by default) so a code
    // change never silently loses a column the user hasn't seen the toggle for yet.
    const extra = COLUMN_DEFS.filter((c) => !savedKeys.has(c.key)).map((c) => ({ key: c.key, visible: true }))
    return [...saved.filter((c) => knownKeys.has(c.key)), ...extra]
  } catch {
    return defaultColumns()
  }
}

/** Persisted show/hide + order for the Envíos table, kept in localStorage (per-browser, no backend). */
export function useColumnPrefs() {
  const [columns, setColumns] = useState<ColState[]>(loadColumns)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns))
  }, [columns])

  return {
    columns,
    setAll(next: ColState[]) {
      setColumns(next)
    },
    reset() {
      setColumns(defaultColumns())
    },
  }
}

/** Button + modal to show/hide and drag-reorder columns. Edits a local draft; only applied on
 * "Guardar" (Cancelar discards it) — same staged-changes pattern as most column customizers. */
export function ColumnPicker({ prefs }: { prefs: ReturnType<typeof useColumnPrefs> }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ColState[]>(prefs.columns)
  const [search, setSearch] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  function openModal() {
    setDraft(prefs.columns)
    setSearch('')
    setOpen(true)
  }
  function toggleDraft(key: string) {
    setDraft((cols) => cols.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))
  }
  function reorderDraft(from: number, to: number) {
    setDraft((cols) => {
      const next = [...cols]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const q = search.trim().toLowerCase()
  const visible = draft.filter((c) => {
    const def = COLUMN_DEFS.find((d) => d.key === c.key)
    return !q || def?.label.toLowerCase().includes(q)
  })

  return (
    <>
      <Button variant="ghost" onClick={openModal}>
        <SlidersHorizontal class="h-4 w-4" aria-hidden="true" /> Columnas
      </Button>
      {open && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div class="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div class="border-b border-gray-100 p-4">
              <div class="flex items-center justify-between">
                <h2 class="text-base font-bold text-secondary">Personalizar columnas</h2>
                <IconButton label="Cerrar" onClick={() => setOpen(false)}>
                  <X class="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </div>
              <p class="mt-0.5 text-xs text-gray-500">Elegí y ordená las columnas de la tabla.</p>
            </div>

            <div class="p-3">
              <div class="relative mb-2">
                <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  class={`${inputCls} w-full pl-8 text-sm`}
                  placeholder="Buscar columna…"
                  value={search}
                  onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
                />
              </div>

              <div class="scroll-thin max-h-72 overflow-y-auto">
                <div class="flex items-center gap-2 rounded-lg px-2 py-2">
                  <Lock class="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden="true" />
                  <span class="flex-1 text-sm text-gray-400">Guía</span>
                  <span class="text-[10px] font-medium uppercase tracking-wide text-gray-300">Fija</span>
                </div>
                <ul>
                  {visible.map((c) => {
                    const def = COLUMN_DEFS.find((d) => d.key === c.key)
                    if (!def) return null
                    const realIdx = draft.findIndex((d) => d.key === c.key)
                    return (
                      <li
                        key={c.key}
                        draggable
                        onDragStart={() => setDragIdx(realIdx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIdx !== null && dragIdx !== realIdx) reorderDraft(dragIdx, realIdx)
                          setDragIdx(null)
                        }}
                        class="flex cursor-grab items-center gap-2 rounded-lg px-2 py-2 active:cursor-grabbing hover:bg-gray-50"
                      >
                        <GripVertical class="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
                        <label class="flex flex-1 items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={c.visible} onChange={() => toggleDraft(c.key)} />
                          {def.label}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-gray-100 p-3">
              <button type="button" class="text-xs font-medium text-primary hover:underline" onClick={() => setDraft(defaultColumns())}>
                Restablecer
              </button>
              <div class="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    prefs.setAll(draft)
                    setOpen(false)
                  }}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
