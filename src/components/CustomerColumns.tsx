import type { JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { GripVertical, Lock, Search, SlidersHorizontal, X } from 'lucide-preact'
import type { Customer } from '../lib/customer'
import { Button, IconButton, inputCls } from './ui'

export interface CustomerColumnDef {
  key: string
  label: string
  render: (c: Customer) => JSX.Element | string
}

/** Weight cell: number with package count in parentheses — "lb" lives in the grouped header. */
function WeightCell({ weight, count }: { weight?: number; count?: number }) {
  return (
    <span class="whitespace-nowrap tabular-nums text-gray-700">
      {Math.round(weight ?? 0).toLocaleString('en-US')} <span class="text-gray-400">({count ?? 0})</span>
    </span>
  )
}

export const CUSTOMER_COLUMN_DEFS: CustomerColumnDef[] = [
  { key: 'casillero', label: 'Casillero', render: (c) => <span class="text-gray-500">{c.casillero || '—'}</span> },
  { key: 'companyName', label: 'Compañía', render: (c) => <span class="text-gray-500">{c.companyName || '—'}</span> },
  { key: 'taxId', label: 'Cédula / RUC', render: (c) => <span class="text-gray-500">{c.taxId || '—'}</span> },
  { key: 'email', label: 'Email', render: (c) => <span class="text-gray-500">{c.email || '—'}</span> },
  { key: 'phone', label: 'Teléfono', render: (c) => <span class="text-gray-500">{c.phone || '—'}</span> },
  { key: 'address', label: 'Dirección', render: (c) => <span class="text-gray-500">{c.address || '—'}</span> },
  {
    key: 'maritimo',
    label: 'Marítimo',
    render: (c) => <WeightCell weight={c.weightMaritimo} count={c.countMaritimo} />,
  },
  {
    key: 'aereo',
    label: 'Aéreo',
    render: (c) => <WeightCell weight={c.weightAereo} count={c.countAereo} />,
  },
]

const DEFAULT_HIDDEN = new Set(['email', 'address'])
const STORAGE_KEY = 'hit-panel:customers:columns:v1'

interface ColState {
  key: string
  visible: boolean
}

function defaultColumns(): ColState[] {
  return CUSTOMER_COLUMN_DEFS.map((c) => ({ key: c.key, visible: !DEFAULT_HIDDEN.has(c.key) }))
}

function loadColumns(): ColState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultColumns()
    const saved = JSON.parse(raw) as ColState[]
    const knownKeys = new Set(CUSTOMER_COLUMN_DEFS.map((c) => c.key))
    const savedKeys = new Set(saved.map((c) => c.key))
    const extra = CUSTOMER_COLUMN_DEFS.filter((c) => !savedKeys.has(c.key)).map((c) => ({ key: c.key, visible: true }))
    return [...saved.filter((c) => knownKeys.has(c.key)), ...extra]
  } catch {
    return defaultColumns()
  }
}

/** Persisted show/hide for the Clientes table (localStorage, no backend). */
export function useCustomerColumnPrefs() {
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

/** Button + modal to choose which columns to show in the Clientes table. */
export function CustomerColumnPicker({ prefs }: { prefs: ReturnType<typeof useCustomerColumnPrefs> }) {
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
    const def = CUSTOMER_COLUMN_DEFS.find((d) => d.key === c.key)
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
              <p class="mt-0.5 text-xs text-gray-500">Elegí y ordená las columnas de datos del cliente.</p>
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
                  <span class="flex-1 text-sm text-gray-400">Nombre</span>
                  <span class="text-[10px] font-medium uppercase tracking-wide text-gray-300">Fija</span>
                </div>
                <ul>
                  {visible.map((c) => {
                    const def = CUSTOMER_COLUMN_DEFS.find((d) => d.key === c.key)
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