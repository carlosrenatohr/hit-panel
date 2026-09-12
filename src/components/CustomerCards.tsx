import { Anchor, Package, Plane, Scale, Trophy, Users } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import type { CustomerAggregateStats } from '../lib/customer'
import { fmtLbs } from '../lib/format'
import { Card } from './ui'
import { MultiSelect } from './ui/MultiSelect'

interface CardDef {
  key: string
  label: string
  icon: typeof Scale
  render: (s: CustomerAggregateStats) => string | null
}

/** KPI card catalog — each entry is toggleable from the "Tarjetas" multiselect. */
const CARD_DEFS: CardDef[] = [
  { key: 'librasTotal', label: 'Libras facturadas', icon: Scale, render: (s) => fmtLbs(s.totalWeightLb) },
  { key: 'librasMaritimo', label: 'Libras marítimo', icon: Anchor, render: (s) => fmtLbs(s.weightMaritimo) },
  { key: 'librasAereo', label: 'Libras aéreo', icon: Plane, render: (s) => fmtLbs(s.weightAereo) },
  { key: 'paquetesTotal', label: 'Paquetes totales', icon: Package, render: (s) => String(s.packageCountTotal) },
  { key: 'paquetesMaritimo', label: 'Paquetes marítimo', icon: Anchor, render: (s) => String(s.packageCountMaritimo) },
  { key: 'paquetesAereo', label: 'Paquetes aéreo', icon: Plane, render: (s) => String(s.packageCountAereo) },
]

const CARD_OPTIONS = [
  ...CARD_DEFS.map((d) => ({ value: d.key, label: d.label })),
  { value: 'topMaritimo', label: 'Top cliente marítimo' },
  { value: 'topAereo', label: 'Top cliente aéreo' },
]

const DEFAULT_HIDDEN_CARDS = new Set(['paquetesMaritimo', 'paquetesAereo'])
const STORAGE_KEY = 'hit-panel:customers:cards:v1'

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_HIDDEN_CARDS]
    const saved = JSON.parse(raw) as string[]
    const known = new Set(CARD_OPTIONS.map((o) => o.value))
    return saved.filter((v) => known.has(v))
  } catch {
    return [...DEFAULT_HIDDEN_CARDS]
  }
}

/** Top client card with a link back to Envíos filtered by that client's name. */
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

/** Responsive KPI grid — the module's summary cards, toggleable by the user. */
export default function CustomerCards({ stats, onViewClient }: { stats: CustomerAggregateStats; onViewClient: (name: string) => void }) {
  const [hidden, setHidden] = useState<string[]>(loadHidden)

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
        <div class="w-44">
          <MultiSelect options={CARD_OPTIONS} selected={hidden} onChange={setHidden} placeholder="Tarjetas" />
        </div>
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
    </div>
  )
}