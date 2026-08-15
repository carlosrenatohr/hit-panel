import { CheckCircle2, ChevronRight, Package, Radio, RefreshCw } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { fmtDateTime, providerLabel, STATUS_ORDER } from '../lib/format'
import { getProviders, getStats } from '../lib/insforge'
import type { Provider, ShipmentStatus, Stats, SessionUser } from '../lib/types'
import { Button, Card, IconButton, SectionTitle, Spinner, StatusDot } from './ui'

function hoursAgo(s?: string | null): number | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(+d)) return null
  return Math.floor((Date.now() - +d) / 3600000)
}

export default function Overview({
  user,
  onOpen,
  onGoShipments,
}: {
  user: SessionUser
  onOpen: (guia: string) => void
  onGoShipments: () => void
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const [s, p] = await Promise.all([getStats(user.agency), getProviders(user.agency)])
      setStats(s)
      setProviders(p)
    } catch {
      setErr('No se pudo cargar el resumen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (err) return <p class="text-red-600">{err}</p>
  if (!stats) return <Spinner label="Cargando resumen…" />

  const maxCount = Math.max(1, ...STATUS_ORDER.map((s) => stats.by_status[s] ?? 0))

  return (
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold tracking-tight text-secondary">Resumen</h1>
        <div class="flex items-center gap-2">
          <IconButton label="Actualizar" onClick={load} disabled={loading}>
            <RefreshCw class={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </IconButton>
          <Button variant="ghost" onClick={onGoShipments}>
            Ver envíos <ChevronRight class="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total de paquetes" value={stats.total} icon={Package} accent />
        <Kpi label="Entregados (30 días)" value={stats.delivered_30d} icon={CheckCircle2} />
        {Object.entries(stats.by_provider).map(([code, n]) => (
          <Kpi key={code} label={providerLabel(code)} value={n} icon={Radio} />
        ))}
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        {/* Pipeline */}
        <Card class="lg:col-span-2">
          <SectionTitle>Pipeline por estado</SectionTitle>
          <div class="space-y-3 p-5">
            {STATUS_ORDER.map((s) => {
              const n = stats.by_status[s] ?? 0
              return (
                <div key={s} class="flex items-center gap-3">
                  <div class="w-40 shrink-0">
                    <StatusDot s={s as ShipmentStatus} />
                  </div>
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div class="h-full rounded-full bg-primary/70" style={`width:${(n / maxCount) * 100}%`} />
                  </div>
                  <div class="w-8 text-right text-sm font-semibold tabular-nums text-gray-700">{n}</div>
                </div>
              )
            })}
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
}: {
  label: string
  value: number
  icon: typeof Package
  accent?: boolean
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
    </Card>
  )
}
