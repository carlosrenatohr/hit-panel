import { Anchor, GripVertical, Package, Plane, Scale, Search, SlidersHorizontal, Trophy, Users, X } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import type { CustomerAggregateStats } from '../lib/customer'
import { fmtLbs } from '../lib/format'
import { Button, Card, IconButton, inputCls } from './ui'

interface CardDef {
  key: string
  label: string
  icon: typeof Scale
  render: (s: CustomerAggregateStats) => string | null
}

const CARD_DEFS: CardDef[] = [
  { key: 'librasTotal', label: 'Libras facturadas', icon: Scale, render: (s) => fmtLbs(s.totalWeightLb) },
  { key: 'librasMaritimo', label: 'Libras marítimo', icon: Anchor, render: (s) => fmtLbs(s.weightMaritimo) },
  { key: 'librasAereo', label: 'Libras aéreo', icon: Plane, render: (s) => fmtLbs(s.weightAereo) },
  { key: 'paquetesTotal', label: 'Paquetes totales', icon: Package, render: (s) => String(s.packageCountTotal) },
  { key: 'paquetesMaritimo', label: 'Paquetes marítimo', icon: Anchor, render: (s) => String(s.packageCountMaritimo) },
  { key: 'paquetesAereo', label: 'Paquetes aéreo', icon: Plane, render: (s) => String(s.packageCountAereo) },
]

const ALL_CARD_OPTIONS = [
  ...CARD_DEFS.map((d) => ({ key: d.key, label: d.label })),
  { key: 'topMaritimo', label: 'Top cliente marítimo' },
  { key: 'topAereo', label: 'Top cliente aéreo' },
]

const DEFAULT_HIDDEN = new Set(['paquetesMaritimo', 'paquetesAereo'])
const STORAGE_KEY = 'hit-panel:customers:cards:v1'

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_HIDDEN]
    const saved = JSON.parse(raw) as string[]
    const known = new Set(ALL_CARD_OPTIONS.map((o) => o.key))
    return saved.filter((v) => known.has(v))
  } catch {
    return [...DEFAULT_HIDDEN]
  }
}

function TopClientCard({ title, top, onViewClient }: { title: string; top: { name: string; weightLb: number } | null; onViewClient: (name: string) => void }) {
  return (
    <Card class="flex flex-col p-4">
      <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
        <Trophy class="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </div>
      {top ? (
        <>
          <button type="button" onClick={() => onViewClient(top.name)} aria-label={`Ver paquetes de ${top.name} en Envíos`} class="mt-1.5 truncate text-left text-sm font-semibold text-primary hover:underline" title={`Ver paquetes de ${top.name} en Envíos`}>
            {top.name}
          </button>
          <div class="mt-0.5 text-lg font-bold tabular-nums text-gray-800">{fmtLbs(top.weightLb)}</div>
        </>
      ) : (
        <div class="mt-1.5 text-sm text-gray-400">Sin movimientos en el rango.</div>
      )}
    </Card>
  )
}

function CardPickerModal({ onClose, hidden, onApply }: { onClose: () => void; hidden: string[]; onApply: (next: string[]) => void }) {
  const [draft, setDraft] = useState<string[]>(hidden)
  const [search, setSearch] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  function toggleDraft(key: string) {
    setDraft((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])
  }

  function reorderDraft(from: number, to: number) {
    setDraft((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const q = search.trim().toLowerCase()
  const filtered = ALL_CARD_OPTIONS.filter((c) => !q || c.label.toLowerCase().includes(q))

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div class="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div class="border-b border-gray-100 p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-secondary">Personalizar tarjetas</h2>
            <IconButton label="Cerrar" onClick={onClose}>
              <X class="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
          <p class="mt-0.5 text-xs text-gray-500">Elegí qué tarjetas KPI se muestran en el resumen.</p>
        </div>

        <div class="p-3">
          <div class="relative mb-2">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              class={`${inputCls} w-full pl-8 text-sm`}
              placeholder="Buscar tarjeta…"
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="scroll-thin max-h-72 overflow-y-auto">
            <ul>
              {filtered.map((c, i) => (
                <li
                  key={c.key}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null && dragIdx !== i) reorderDraft(dragIdx, i)
                    setDragIdx(null)
                  }}
                  class="flex cursor-grab items-center gap-2 rounded-lg px-2 py-2 active:cursor-grabbing hover:bg-gray-50"
                >
                  <GripVertical class="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
                  <label class="flex flex-1 items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={!draft.includes(c.key)} onChange={() => toggleDraft(c.key)} />
                    {c.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-gray-100 p-3">
          <button type="button" class="text-xs font-medium text-primary hover:underline" onClick={() => setDraft([...DEFAULT_HIDDEN])}>
            Restablecer
          </button>
          <div class="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => { onApply(draft); onClose() }}>Guardar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CustomerCards({ stats, onViewClient }: { stats: CustomerAggregateStats; onViewClient: (name: string) => void }) {
  const [hidden, setHidden] = useState<string[]>(loadHidden)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden))
  }, [hidden])

  const showTopMar = !hidden.includes('topMaritimo')
  const showTopAer = !hidden.includes('topAereo')
  const metricCards = CARD_DEFS.filter((d) => !hidden.includes(d.key))

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
          <Users class="h-3.5 w-3.5" aria-hidden="true" /> Resumen del rango
        </span>
        <Button variant="ghost" onClick={() => setPickerOpen(true)}>
          <SlidersHorizontal class="h-4 w-4" aria-hidden="true" /> Tarjetas
        </Button>
      </div>
      <div class="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {metricCards.map((d) => {
          const Icon = d.icon
          const value = d.render(stats)
          return (
            <Card key={d.key} class="flex items-center gap-3 p-4">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon class="h-4 w-4" aria-hidden="true" />
              </span>
              <div class="min-w-0">
                <div class="truncate text-xs text-gray-400">{d.label}</div>
                <div class="truncate text-lg font-bold tabular-nums text-gray-800">{value}</div>
              </div>
            </Card>
          )
        })}
        {showTopMar && <TopClientCard title="Top cliente marítimo" top={stats.topMaritimo} onViewClient={onViewClient} />}
        {showTopAer && <TopClientCard title="Top cliente aéreo" top={stats.topAereo} onViewClient={onViewClient} />}
      </div>
      {pickerOpen && (
        <CardPickerModal onClose={() => setPickerOpen(false)} hidden={hidden} onApply={setHidden} />
      )}
    </div>
  )
}
