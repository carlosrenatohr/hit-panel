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
  Star,
  Truck,
  Warehouse,
} from 'lucide-preact'
import { STATUS_LABEL, STATUS_SOFT } from '../../lib/format'
import type { ShipmentStatus } from '../../lib/types'

export type ServiceFilter = 'all' | 'aereo' | 'maritimo'

// Main operational flow — 4 leading steps plus the combined final slot (entregado + special states).
const MAIN_STATUSES: ShipmentStatus[] = ['en_almacen', 'parcial', 'en_transito', 'en_destino']
// Secondary control states — compact cards stacked under Entregado in the final slot.
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
export function TransportTabs({ value, onChange }: { value: ServiceFilter; onChange: (v: ServiceFilter) => void }) {
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

function Arrow() {
  return (
    <span class="flex shrink-0 items-center justify-center lg:w-6" aria-hidden="true">
      <ChevronRight class="h-4 w-4 rotate-90 text-gray-300 lg:rotate-0" />
    </span>
  )
}

function StatusCard({
  status,
  count,
  active,
  loading,
  onToggle,
  compact = false,
  highlight = false,
}: {
  status: ShipmentStatus
  count: number
  active: boolean
  loading: boolean
  onToggle: (s: ShipmentStatus) => void
  compact?: boolean
  /** Branding border treatment to surface "en destino" as the actionable pickup state. */
  highlight?: boolean
}) {
  const Icon = STATUS_ICON[status]
  const iconCls = compact ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-lg'
  const iconSize = compact ? 'h-4 w-4' : 'h-5 w-5'
  const countCls = compact ? 'text-xl' : 'text-2xl'
  const borderCls = active
    ? 'border-primary bg-primary/5 ring-1 ring-primary'
    : highlight
      ? 'border-primary/50 ring-1 ring-primary/10 hover:border-primary/70'
      : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
  return (
    <button
      type="button"
      onClick={() => onToggle(status)}
      aria-pressed={active}
      aria-label={`Filtrar por ${STATUS_LABEL[status]}`}
      title={active ? 'Quitar filtro de estado' : `Filtrar por ${STATUS_LABEL[status]}`}
      class={`relative flex h-full w-full flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
        compact ? 'gap-2 p-3' : 'gap-2.5 p-4'
      } ${borderCls}`}
    >
      <span class={`flex ${iconCls} items-center justify-center ${STATUS_SOFT[status]}`} aria-hidden="true">
        <Icon class={iconSize} />
      </span>
      <span>
        <span class={`block text-sm font-semibold leading-tight ${active ? 'text-primary' : 'text-gray-700'}`}>{STATUS_LABEL[status]}</span>
        <span class={`mt-1 block ${countCls} font-bold tabular-nums tracking-tight ${active ? 'text-primary' : 'text-secondary'}`}>
          {loading ? <span class="inline-block h-6 w-8 animate-pulse rounded bg-gray-100" /> : count}
        </span>
      </span>
      {highlight && (
        <span
          class={`absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            active ? 'bg-primary text-white' : 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30'
          }`}
        >
          <Star class="h-3 w-3" aria-hidden="true" />
          Listo para retiro
        </span>
      )}
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
  const iconCls = alert ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
  const labelCls = alert ? 'text-red-700' : 'text-gray-600'
  return (
    <button
      type="button"
      onClick={() => onToggle(status)}
      aria-pressed={active}
      aria-label={`Filtrar por ${STATUS_LABEL[status]}`}
      title={active ? 'Quitar filtro de estado' : `Filtrar por ${STATUS_LABEL[status]}`}
      class={`flex h-full min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : alert
            ? 'border-red-100 bg-white hover:border-red-200 hover:bg-red-50/40'
            : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span class={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${iconCls}`} aria-hidden="true">
        <Icon class="h-3 w-3" />
      </span>
      <span class={`min-w-0 truncate text-[11px] font-semibold leading-tight ${active ? 'text-primary' : labelCls}`}>
        {STATUS_LABEL[status]}
      </span>
      <span class={`shrink-0 text-[11px] font-bold tabular-nums ${active ? 'text-primary' : 'text-gray-500'}`}>
        {loading ? <span class="inline-block h-2.5 w-5 animate-pulse rounded bg-gray-100" /> : count}
      </span>
    </button>
  )
}

/**
 * Lifecycle cards of Paquetería: the main operational flow (4 steps + arrows) followed by a final
 * slot that stacks Entregado on top and the special states (excepción/desconocido) below — compact,
 * visibly secondary, yet fully functional filters of the table.
 */
export default function LifecycleOverview({
  counts,
  loading,
  activeStatus,
  onStatusChange,
}: {
  counts: Partial<Record<ShipmentStatus, number>>
  loading: boolean
  activeStatus?: ShipmentStatus
  onStatusChange: (s: ShipmentStatus | undefined) => void
}) {
  const toggleStatus = (s: ShipmentStatus) => onStatusChange(activeStatus === s ? undefined : s)
  return (
    <div class="flex flex-col gap-2 lg:flex-row lg:items-stretch">
      {MAIN_STATUSES.map((s, i) => (
        <Fragment key={s}>
          {i > 0 && <Arrow />}
          <div class="flex-1">
            <StatusCard
              status={s}
              count={counts[s] ?? 0}
              active={activeStatus === s}
              loading={loading}
              onToggle={toggleStatus}
              highlight={s === 'en_destino'}
            />
          </div>
        </Fragment>
      ))}
      <Arrow />
      {/* Final slot: Entregado (less relevant) on top, special states stacked below */}
      <div class="flex flex-1 flex-col gap-2">
        <div class="flex-1">
          <StatusCard status="entregado" count={counts.entregado ?? 0} active={activeStatus === 'entregado'} loading={loading} onToggle={toggleStatus} compact />
        </div>
        <div class="grid grid-cols-2 gap-2">
          {SPECIAL_STATUSES.map((s) => (
            <SpecialCard key={s} status={s} count={counts[s] ?? 0} active={activeStatus === s} loading={loading} onToggle={toggleStatus} />
          ))}
        </div>
      </div>
    </div>
  )
}