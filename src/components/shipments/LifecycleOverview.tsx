import { Fragment } from 'preact'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Layers,
  MapPin,
  Plane,
  Ship,
  Split,
  Truck,
  Warehouse,
} from 'lucide-preact'
import { STATUS_LABEL, STATUS_SOFT } from '../../lib/format'
import type { ShipmentStatus } from '../../lib/types'

export type ServiceFilter = 'all' | 'aereo' | 'maritimo'

// Main operational flow — visual sequence, largest cards. Matches STATUS_ORDER order.
const MAIN_STATUSES: ShipmentStatus[] = ['en_almacen', 'parcial', 'en_transito', 'en_destino', 'entregado']
// Secondary control states — compact cards, visually detached from the flow.
const SPECIAL_STATUSES: ShipmentStatus[] = ['excepcion', 'desconocido']

const STATUS_ICON: Record<ShipmentStatus, typeof Warehouse> = {
  en_almacen: Warehouse,
  parcial: Split,
  en_transito: Truck,
  en_destino: MapPin,
  entregado: CheckCircle2,
  excepcion: AlertTriangle,
  desconocido: HelpCircle,
}

/** Segmented selector for transport type — reuses the toggle pattern already used in Configuración. */
function TransportTabs({ value, onChange }: { value: ServiceFilter; onChange: (v: ServiceFilter) => void }) {
  const tabs: { key: ServiceFilter; label: string; icon: typeof Plane }[] = [
    { key: 'all', label: 'Todos', icon: Layers },
    { key: 'aereo', label: 'Aéreo', icon: Plane },
    { key: 'maritimo', label: 'Marítimo', icon: Ship },
  ]
  return (
    <div class="flex flex-wrap items-center gap-2">
      {tabs.map((t) => {
        const Icon = t.icon
        const active = value === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={active}
            class={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
              active ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <Icon class="h-4 w-4" aria-hidden="true" />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function StatusCard({
  status,
  count,
  active,
  loading,
  onToggle,
}: {
  status: ShipmentStatus
  count: number
  active: boolean
  loading: boolean
  onToggle: (s: ShipmentStatus) => void
}) {
  const Icon = STATUS_ICON[status]
  return (
    <button
      type="button"
      onClick={() => onToggle(status)}
      aria-pressed={active}
      aria-label={`Filtrar por ${STATUS_LABEL[status]}`}
      title={active ? 'Quitar filtro de estado' : `Filtrar por ${STATUS_LABEL[status]}`}
      class={`flex h-full w-full flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
        active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span class={`flex h-9 w-9 items-center justify-center rounded-lg ${STATUS_SOFT[status]}`} aria-hidden="true">
        <Icon class="h-5 w-5" />
      </span>
      <span>
        <span class={`block text-sm font-semibold leading-tight ${active ? 'text-primary' : 'text-gray-700'}`}>{STATUS_LABEL[status]}</span>
        <span
          class={`mt-1 block text-2xl font-bold tabular-nums tracking-tight ${active ? 'text-primary' : 'text-secondary'}`}
        >
          {loading ? <span class="inline-block h-6 w-8 animate-pulse rounded bg-gray-100" /> : count}
        </span>
      </span>
    </button>
  )
}

function SpecialCard({
  status,
  count,
  active,
  loading,
  onToggle,
}: {
  status: ShipmentStatus
  count: number
  active: boolean
  loading: boolean
  onToggle: (s: ShipmentStatus) => void
}) {
  const Icon = STATUS_ICON[status]
  const alert = status === 'excepcion'
  const chipCls = alert ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
  const labelCls = alert ? 'text-red-700' : 'text-gray-600'
  return (
    <button
      type="button"
      onClick={() => onToggle(status)}
      aria-pressed={active}
      aria-label={`Filtrar por ${STATUS_LABEL[status]}`}
      title={active ? 'Quitar filtro de estado' : `Filtrar por ${STATUS_LABEL[status]}`}
      class={`inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : alert
            ? 'border-red-100 bg-white hover:border-red-200 hover:bg-red-50/40'
            : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span class={`flex h-7 w-7 items-center justify-center rounded-md ${chipCls}`} aria-hidden="true">
        <Icon class="h-3.5 w-3.5" />
      </span>
      <span>
        <span class={`block text-sm font-semibold leading-tight ${active ? 'text-primary' : labelCls}`}>{STATUS_LABEL[status]}</span>
        <span class={`block text-xs font-semibold tabular-nums ${active ? 'text-primary' : 'text-gray-500'}`}>
          {loading ? (
            <span class="inline-block h-3 w-6 animate-pulse rounded bg-gray-100" />
          ) : (
            `${count} paquete${count === 1 ? '' : 's'}`
          )}
        </span>
      </span>
    </button>
  )
}

/**
 * Top section of Paquetería: transport selector (tabs) + lifecycle cards with totals.
 * Main flow (5 cards, arrows) first, special states (excepción/desconocido) below as
 * compact secondary indicators. Every card is a functional filter of the table.
 */
export default function LifecycleOverview({
  counts,
  loading,
  activeStatus,
  service,
  onServiceChange,
  onStatusChange,
}: {
  counts: Partial<Record<ShipmentStatus, number>>
  loading: boolean
  activeStatus?: ShipmentStatus
  service: ServiceFilter
  onServiceChange: (v: ServiceFilter) => void
  onStatusChange: (s: ShipmentStatus | undefined) => void
}) {
  const toggleStatus = (s: ShipmentStatus) => onStatusChange(activeStatus === s ? undefined : s)
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <span class="text-xs font-medium uppercase tracking-wide text-gray-400">Tipo de transporte</span>
        <TransportTabs value={service} onChange={onServiceChange} />
      </div>

      {/* Main operational flow — connected sequence */}
      <div class="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {MAIN_STATUSES.map((s, i) => (
          <Fragment key={s}>
            {i > 0 && (
              <span class="flex shrink-0 items-center justify-center lg:w-6" aria-hidden="true">
                <ChevronRight class="h-4 w-4 rotate-90 text-gray-300 lg:rotate-0" />
              </span>
            )}
            <div class="flex-1">
              <StatusCard status={s} count={counts[s] ?? 0} active={activeStatus === s} loading={loading} onToggle={toggleStatus} />
            </div>
          </Fragment>
        ))}
      </div>

      {/* Special states — detached from the flow, still functional filters */}
      <div class="flex items-center gap-3">
        <span class="text-xs font-medium uppercase tracking-wide text-gray-400">Estados especiales</span>
        <span class="h-px flex-1 bg-gray-100" aria-hidden="true" />
      </div>
      <div class="flex flex-wrap gap-2">
        {SPECIAL_STATUSES.map((s) => (
          <SpecialCard key={s} status={s} count={counts[s] ?? 0} active={activeStatus === s} loading={loading} onToggle={toggleStatus} />
        ))}
      </div>
    </div>
  )
}