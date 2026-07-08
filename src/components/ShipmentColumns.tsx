import type { JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
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
import { Button, HazmatBadge, StaleBadge, StatusDot } from './ui'
import { GripVertical, SlidersHorizontal } from 'lucide-preact'

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
    toggle(key: string) {
      setColumns((cols) => cols.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))
    },
    reorder(from: number, to: number) {
      setColumns((cols) => {
        const next = [...cols]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      })
    },
    reset() {
      setColumns(defaultColumns())
    },
  }
}

/** Button + popover to show/hide and drag-reorder columns. */
export function ColumnPicker({ prefs }: { prefs: ReturnType<typeof useColumnPrefs> }) {
  const [open, setOpen] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div class="relative" ref={boxRef}>
      <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal class="h-4 w-4" aria-hidden="true" /> Columnas
      </Button>
      {open && (
        <div class="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
          <div class="flex items-center justify-between px-2 py-1">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-400">Mostrar / ordenar</span>
            <button class="text-xs font-medium text-primary hover:underline" onClick={prefs.reset}>
              Restablecer
            </button>
          </div>
          <ul>
            {prefs.columns.map((c, i) => {
              const def = COLUMN_DEFS.find((d) => d.key === c.key)
              if (!def) return null
              return (
                <li
                  key={c.key}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null && dragIdx !== i) prefs.reorder(dragIdx, i)
                    setDragIdx(null)
                  }}
                  class="flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 active:cursor-grabbing hover:bg-gray-50"
                >
                  <GripVertical class="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
                  <label class="flex flex-1 items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={c.visible} onChange={() => prefs.toggle(c.key)} />
                    {def.label}
                  </label>
                </li>
              )
            })}
          </ul>
          <p class="border-t border-gray-100 px-2 pt-1.5 text-[11px] text-gray-400">Arrastrá para reordenar.</p>
        </div>
      )}
    </div>
  )
}
