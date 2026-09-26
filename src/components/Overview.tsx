import { AlertTriangle, CheckCircle2, ChevronRight, Package, Radio, RefreshCw, Star, Users } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { fmtDateTime, providerLabel, STATUS_LABEL, STATUS_ORDER } from '../lib/format'
import { getProviders, getStats, getUnassignedPackages } from '../lib/insforge'
import { capCards } from '../lib/cards'
import type { Provider, ShipmentStatus, Stats, SessionUser } from '../lib/types'
import { Button, Card, IconButton, inputCls, SectionTitle, Spinner, StatusDot } from './ui'
import { DateRangePicker } from './DateRangePicker'

function hoursAgo(s?: string | null): number | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(+d)) return null
  return Math.floor((Date.now() - +d) / 3600000)
}

// All-time by default; the filter card narrows the aggregates by reception date
// and effective status (the RPC applies them server-side).
export default function Overview({
  user,
  onOpen,
  onGoShipments,
  onGoUnassigned,
  onGoStatus,
}: {
  user: SessionUser
  onOpen: (guia: string) => void
  onGoShipments: () => void
  onGoUnassigned: () => void
  /** Drilldown: opens Paquetería with that canonical status already applied. */
  onGoStatus: (s: ShipmentStatus) => void
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const [s, p, u] = await Promise.all([
        getStats(user.agency, from || undefined, to || undefined, status || undefined),
        getProviders(user.agency),
        getUnassignedPackages(user.agency, from || undefined, to || undefined, 1),
      ])
      setStats(s)
      setProviders(p)
      setUnassignedCount(u.count)
    } catch {
      setErr('No se pudo cargar el resumen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, status])

  if (err) return <p class="text-red-600">{err}</p>
  if (!stats) return <Spinner label="Cargando resumen…" />

  const maxCount = Math.max(1, ...STATUS_ORDER.map((s) => stats.by_status[s] ?? 0))
  const hasFilters = from || to || status
  // % only while unfiltered: dashboard_stats narrows `total` to p_status, so the ratio
  // would read 100% for a single bar (same reasoning as Reports' Trend guard).
  const showStatusPct = !status && stats.total > 0
  const providerTotal = Object.values(stats.by_provider).reduce((a, n) => a + n, 0)
  const exceptions = stats.by_status.excepcion ?? 0
  const readyForPickup = stats.by_status.en_destino ?? 0
  const hasActions = exceptions > 0 || readyForPickup > 0

  return (
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold tracking-tight text-secondary">Resumen</h1>
        <div class="flex items-center gap-2">
          <IconButton label="Actualizar" onClick={load} disabled={loading}>
            <RefreshCw class={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </IconButton>
          <Button variant="ghost" onClick={onGoShipments}>
            Ver paquetes <ChevronRight class="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card class="p-3">
        <div class="flex flex-wrap items-end gap-2">
          <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f ?? ''); setTo(t ?? '') }} />
          <select class={inputCls} value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}>
            <option value="">Todos los estados</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {hasFilters && (
            <Button variant="ghost" onClick={() => { setFrom(''); setTo(''); setStatus('') }}>
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      {/* Actionable first: what the operator has to act on right now */}
      {hasActions && (
        <section aria-label="Requiere acción" class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-gray-500">Requiere acción</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            {exceptions > 0 && (
              <Card accent class="flex items-center justify-between gap-3 p-4">
                <div class="flex items-center gap-3">
                  <AlertTriangle class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <span class="text-sm font-semibold text-secondary">
                      {exceptions} {exceptions !== 1 ? 'excepciones' : 'excepción'} para revisar
                    </span>
                    <p class="text-xs text-gray-500">Paquetes que se salieron del flujo operativo.</p>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => onGoStatus('excepcion')}>
                  Ver <ChevronRight class="h-4 w-4" aria-hidden="true" />
                </Button>
              </Card>
            )}
            {readyForPickup > 0 && (
              <Card accent class="flex items-center justify-between gap-3 p-4">
                <div class="flex items-center gap-3">
                  <Star class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <span class="text-sm font-semibold text-secondary">
                      {readyForPickup} listo{readyForPickup !== 1 ? 's' : ''} para retiro
                    </span>
                    <p class="text-xs text-gray-500">En destino (Nicaragua), esperando al cliente.</p>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => onGoStatus('en_destino')}>
                  Ver <ChevronRight class="h-4 w-4" aria-hidden="true" />
                </Button>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* KPIs */}
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {capCards([
          <Kpi label="Total de paquetes" value={stats.total} icon={Package} accent />,
          <Kpi label="Entregados (30 días)" value={stats.delivered_30d} icon={CheckCircle2} />,
          ...Object.entries(stats.by_provider).map(([code, n]) => (
            <Kpi
              key={code}
              label={providerLabel(code)}
              value={n}
              icon={Radio}
              hint={providerTotal > 0 ? `${Math.round((n / providerTotal) * 100)}% del total` : undefined}
            />
          )),
        ])}
      </div>

      {/* Unassigned packages CTA */}
      {unassignedCount > 0 && (
        <Card accent class="flex items-center justify-between p-4">
          <div class="flex items-center gap-3">
            <Users class="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <span class="text-sm font-semibold text-secondary">{unassignedCount} paquete{unassignedCount !== 1 ? 's' : ''} sin cliente formal en el rango</span>
              <p class="text-xs text-gray-500">Asigná un cliente para habilitar facturación y tracking por cliente.</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onGoUnassigned}>
            Revisar <ChevronRight class="h-4 w-4" aria-hidden="true" />
          </Button>
        </Card>
      )}

      <div class="grid gap-6 lg:grid-cols-3">
        {/* Estados */}
        <Card class="lg:col-span-2">
          <SectionTitle>Estados de los paquetes</SectionTitle>
          <div class="space-y-3 p-5">
            {STATUS_ORDER.map((s) => {
              const n = stats.by_status[s] ?? 0
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onGoStatus(s)}
                  aria-label={`Ver ${STATUS_LABEL[s]} en Paquetería`}
                  class="flex w-full items-center gap-3 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div class="w-40 shrink-0">
                    <StatusDot s={s as ShipmentStatus} />
                  </div>
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div class="h-full rounded-full bg-primary/70" style={`width:${(n / maxCount) * 100}%`} />
                  </div>
                  <div class="w-8 text-right text-sm font-semibold tabular-nums text-gray-700">{n}</div>
                  {showStatusPct && (
                    <div class="w-11 shrink-0 text-right text-xs font-medium tabular-nums text-gray-400">
                      {Math.round((n / stats.total) * 100)}%
                    </div>
                  )}
                </button>
              )
            })}
            {showStatusPct && (
              <p class="border-t border-gray-100 pt-3 text-[11px] text-gray-400">% del total de paquetes en el rango.</p>
            )}
          </div>
        </Card>

        {/* Ingest health */}
        <Card>
          <SectionTitle>Salud de la ingesta</SectionTitle>
          <div class="space-y-4 p-5">
            {providers.map((p) => {
              const last = stats.last_scraped[p.code]
              const h = hoursAgo(last)
              const ok = h !== null && h <= 6
              const warn = h !== null && h > 6 && h <= 24
              return (
                <div key={p.code} class="flex items-start gap-3">
                  <span
                    class={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                      ok ? 'bg-green-500' : warn ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <div class="text-sm font-medium text-gray-800">{providerLabel(p.code)}</div>
                    <div class="text-xs text-gray-500">
                      {fmtDateTime(last)}
                      {h !== null && <span class="text-gray-400"> · hace {h}h</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            <p class="border-t border-gray-100 pt-3 text-[11px] text-gray-400">
              Verde ≤6h · amarillo ≤24h · rojo &gt;24h.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
  hint,
}: {
  label: string
  value: number
  icon: typeof Package
  accent?: boolean
  /** Secondary line (share % of its own denominator) — never a bare absolute. */
  hint?: string
}) {
  return (
    <Card accent={accent} class="p-4">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
        <Icon class={`h-4 w-4 ${accent ? 'text-primary' : 'text-gray-300'}`} aria-hidden="true" />
      </div>
      <div class={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${accent ? 'text-primary' : 'text-secondary'}`}>
        {value}
      </div>
      {hint && <div class="mt-1 text-xs font-medium text-gray-400">{hint}</div>}
    </Card>
  )
}
