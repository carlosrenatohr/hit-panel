import { useEffect, useState } from 'preact/hooks'
import { fmtDateTime, providerLabel, STATUS_LABEL, STATUS_ORDER } from '../lib/format'
import { getProviders, getStats } from '../lib/insforge'
import type { Provider, ShipmentStatus, Stats } from '../lib/types'
import { Button, Card, Spinner, StatusPill } from './ui'

function hoursAgo(s?: string | null): number | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(+d)) return null
  return Math.floor((Date.now() - +d) / 3600000)
}

export default function Overview({
  onOpen,
  onGoShipments,
}: {
  onOpen: (guia: string) => void
  onGoShipments: () => void
}) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [s, p] = await Promise.all([getStats(), getProviders()])
        setStats(s)
        setProviders(p)
      } catch {
        setErr('No se pudo cargar el resumen.')
      }
    })()
  }, [])

  if (err) return <p class="text-red-600">{err}</p>
  if (!stats) return <Spinner label="Cargando resumen…" />

  const maxCount = Math.max(1, ...STATUS_ORDER.map((s) => stats.by_status[s] ?? 0))

  return (
    <div class="mx-auto max-w-6xl space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-secondary">Resumen operativo</h1>
          <p class="text-sm text-slate-500">Estado de los envíos y de la ingesta de datos.</p>
        </div>
        <Button variant="ghost" onClick={onGoShipments}>
          Ver envíos →
        </Button>
      </div>

      {/* KPIs */}
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total de paquetes" value={stats.total} />
        <Kpi label="Entregados (30 días)" value={stats.delivered_30d} accent />
        {Object.entries(stats.by_provider).map(([code, n]) => (
          <Kpi key={code} label={providerLabel(code)} value={n} />
        ))}
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        {/* Pipeline */}
        <Card class="lg:col-span-2">
          <div class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-secondary">
            Pipeline por estado
          </div>
          <div class="space-y-3 p-5">
            {STATUS_ORDER.map((s) => {
              const n = stats.by_status[s] ?? 0
              return (
                <div key={s} class="flex items-center gap-3">
                  <div class="w-44 shrink-0">
                    <StatusPill s={s as ShipmentStatus} />
                  </div>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-primary/70" style={`width:${(n / maxCount) * 100}%`} />
                  </div>
                  <div class="w-10 text-right text-sm font-medium text-slate-700">{n}</div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Ingest health */}
        <Card>
          <div class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-secondary">
            Salud de la ingesta
          </div>
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
                  />
                  <div>
                    <div class="text-sm font-medium text-slate-800">{providerLabel(p.code)}</div>
                    <div class="text-xs text-slate-500">
                      Última ingesta: {fmtDateTime(last)}
                      {h !== null && <span class="text-slate-400"> · hace {h}h</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            <p class="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              Verde ≤6h · amarillo ≤24h · rojo &gt;24h. El cron refresca cada 2h por proveedor.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card class="p-4">
      <div class="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div class={`mt-1 text-3xl font-bold ${accent ? 'text-primary' : 'text-secondary'}`}>{value}</div>
    </Card>
  )
}
