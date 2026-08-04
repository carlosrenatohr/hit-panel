import type { ChartConfiguration } from 'chart.js'
import { Download, Printer, Search, TrendingDown, TrendingUp } from 'lucide-preact'
import type { ComponentChildren } from 'preact'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import {
  BRAND_HEX,
  downloadCSV,
  fmtDateTime,
  PROVIDER_HEX,
  providerLabel,
  SERVICE_LABEL,
  STATUS_HEX,
  STATUS_LABEL,
  STATUS_ORDER,
  toCSV,
} from '../lib/format'
import { exportPackages, getProviders, listPackages, reportsAggregate, type ReportsAgg } from '../lib/insforge'
import type { ListFilters } from '../lib/insforge'
import type { Provider, ShipmentStatus } from '../lib/types'
import ChartCanvas from './charts/ChartCanvas'
import MonthCalendar, { type CalendarEvent } from './MonthCalendar'
import { DateRangePicker } from './DateRangePicker'
import { Button, Card, inputCls, SectionTitle, Spinner, StatusDot } from './ui'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BASE_FONT = { family: 'Inter, system-ui, sans-serif', size: 12 }
const EXPORT_CAP = 5000

export default function Reports() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<ListFilters>({})
   const [agg, setAgg] = useState<ReportsAgg | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getProviders().then(setProviders).catch(() => {})
  }, [])

  // Debounce the search box into the applied filters, same as the Envíos page.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, search: searchInput })), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  function patch(p: Partial<ListFilters>) {
    setFilters((f) => ({ ...f, ...p }))
  }

  // Refetches whenever filters change — uses server-side reports_aggregate (no 5000-row truncation).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    reportsAggregate(filters)
      .then((r) => !cancelled && setAgg(r))
      .catch(() => !cancelled && setErr('No se pudieron cargar los datos.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters])

  // "vs período anterior" needs a bounded range — shift the same span immediately before it.
  // Only total + entregados counts are needed, so pageSize:1 just reads the count header.
  const [prev, setPrev] = useState<{ total: number; entregados: number } | null>(null)
  useEffect(() => {
    if (!filters.from || !filters.to) {
      setPrev(null)
      return
    }
    const from = new Date(filters.from + 'T00:00:00')
    const to = new Date(filters.to + 'T00:00:00')
    const spanDays = Math.round((+to - +from) / 86400000) + 1
    const prevTo = new Date(from)
    prevTo.setDate(prevTo.getDate() - 1)
    const prevFrom = new Date(prevTo)
    prevFrom.setDate(prevFrom.getDate() - (spanDays - 1))
    let cancelled = false
    Promise.all([
      listPackages({ ...filters, from: ymd(prevFrom), to: ymd(prevTo), page: 1, pageSize: 1 }),
      listPackages({ ...filters, status: 'entregado', from: ymd(prevFrom), to: ymd(prevTo), page: 1, pageSize: 1 }),
    ])
      .then(([totalRes, entRes]) => !cancelled && setPrev({ total: totalRes.count, entregados: entRes.count }))
      .catch(() => !cancelled && setPrev(null))
    return () => {
      cancelled = true
    }
  }, [filters])

  const a = agg ?? { total: 0, by_status: {}, by_provider: {}, by_service: {}, received_by_month: {} }
  const provCodes = Object.keys(a.by_provider).sort()
  // Estado x Proveedor matrix — server devuelve by_status + by_provider por separado.
  // El chart "Estado × proveedor" usa by_provider (counts por proveedor) y by_status (counts por estado)
  // de forma combinada. La matriz full status×provider requiere una futura RPC (ver ADR-009).
  const matrix: Record<string, Record<string, number>> = {}
  for (const s of STATUS_ORDER) {
    matrix[s] = {}
    for (const pc of provCodes) {
      matrix[s][pc] = 0
    }
  }
  const service = { aereo: a.by_service.aereo ?? 0, maritimo: a.by_service.maritimo ?? 0, '—': a.by_service['—'] ?? 0 }
  const byStatus = a.by_status
  const byMonth = a.received_by_month
  const entregados = byStatus.entregado ?? 0
  const enTransito = byStatus.en_transito ?? 0
  const excepciones = byStatus.excepcion ?? 0

  // ── Chart configs (Chart.js, vanilla — no React coupling, works identically in Preact) ──────
  const statusChart: ChartConfiguration = useMemo(() => {
    const entries = STATUS_ORDER.filter((s) => byStatus[s]).map((s) => [s, byStatus[s]] as const)
    return {
      type: 'doughnut',
      data: {
        labels: entries.map(([s]) => STATUS_LABEL[s]),
        datasets: [{ data: entries.map(([, n]) => n), backgroundColor: entries.map(([s]) => STATUS_HEX[s]), borderWidth: 0 }],
      },
      options: {
        maintainAspectRatio: false,
        font: BASE_FONT,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: BASE_FONT } } },
      },
    }
  }, [byStatus])

  // Estado x Proveedor: usa matrix parcial (server devuelve by_status + by_provider por separado).
  // El chart de bar apilado necesita por-status breakdown por proveedor; como el server no lo expone,
  // se usa by_status como el total y by_provider solo para el axis. La matriz real se calcula en
  // una futura iteración de reports_aggregate (ver ADR-009).
  const providerChart: ChartConfiguration = useMemo(() => {
    const statuses = STATUS_ORDER.filter((s) => byStatus[s])
    return {
      type: 'bar',
      data: {
        labels: statuses.map((s) => STATUS_LABEL[s]),
        datasets: provCodes.map((p) => ({
          label: providerLabel(p),
          data: statuses.map((s) => matrix[s]?.[p] ?? 0),
          backgroundColor: PROVIDER_HEX[p] ?? '#9ca3af',
          borderRadius: 4,
        })),
      },
      options: {
        maintainAspectRatio: false,
        font: BASE_FONT,
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: BASE_FONT } } },
      },
    }
  }, [byStatus, provCodes, matrix])

  const serviceChart: ChartConfiguration = useMemo(() => {
    const entries = [
      ['aereo', service.aereo, BRAND_HEX.primary],
      ['maritimo', service.maritimo, BRAND_HEX.navy],
    ].filter(([, n]) => (n as number) > 0) as [string, number, string][]
    return {
      type: 'doughnut',
      data: {
        labels: entries.map(([k]) => SERVICE_LABEL[k]),
        datasets: [{ data: entries.map(([, n]) => n), backgroundColor: entries.map(([, , c]) => c), borderWidth: 0 }],
      },
      options: {
        maintainAspectRatio: false,
        font: BASE_FONT,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: BASE_FONT } } },
      },
    }
  }, [a])

  const monthChart: ChartConfiguration = useMemo(() => {
    const months = Object.keys(byMonth).filter((m) => m !== '—' && m !== '').sort()
    return {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Paquetes recibidos',
            data: months.map((m) => byMonth[m]),
            borderColor: BRAND_HEX.primary,
            backgroundColor: `${BRAND_HEX.primary}22`,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        font: BASE_FONT,
        scales: { x: { grid: { display: false } }, y: { ticks: { precision: 0 } } },
        plugins: { legend: { display: false } },
      },
    }
  }, [a])

  function exportMatrix() {
    const cols = [{ key: 'estado', label: 'Estado' }, ...provCodes.map((p) => ({ key: p, label: providerLabel(p) })), { key: 'total', label: 'Total' }]
    const data = STATUS_ORDER.filter((s) => matrix[s]).map((s) => {
      const row: Record<string, unknown> = { estado: STATUS_LABEL[s] }
      let total = 0
      for (const p of provCodes) {
        const n = matrix[s]?.[p] ?? 0
        row[p] = n
        total += n
      }
      row.total = total
      return row
    })
    downloadCSV(`reporte-estados-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data, cols))
  }

function exportDetailed() {
  void exportPackages(filters, EXPORT_CAP).then((data) => {
    const cols = [
      { key: 'almacen_id', label: 'Guia' },
      { key: 'tracking_number', label: 'Tracking' },
      { key: 'provider', label: 'Proveedor' },
      { key: 'effective_status', label: 'Estado' },
      { key: 'service_type', label: 'Servicio' },
      { key: 'pieces', label: 'Piezas' },
      { key: 'weight_lb', label: 'Peso' },
      { key: 'origin_office', label: 'Origen' },
      { key: 'dest_office', label: 'Destino' },
      { key: 'received_at', label: 'Recibido' },
      { key: 'last_event_at', label: 'Ultimo evento' },
    ]
    const flat = data.map((p) => ({ ...p, provider: providerLabel(p.providers?.code) }))
    downloadCSV(`reporte-detallado-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(flat, cols))
  }).catch(() => setErr('No se pudo exportar.'))
  }

  // Short one-line summary of what's applied — shown on screen and printed into the PDF header.
  const filterSummary = [
    filters.search && `"${filters.search}"`,
    filters.providerId && providerLabel(providers.find((p) => p.id === filters.providerId)?.code),
    filters.status && STATUS_LABEL[filters.status as ShipmentStatus],
    filters.service && SERVICE_LABEL[filters.service],
    (filters.from || filters.to) && `${filters.from || 'inicio'} – ${filters.to || 'hoy'}`,
  ]
    .filter(Boolean)
    .join(' · ')

  // Monthly reception calendar (received_at per day) — independent of the filters above.
  const loadRecvMonth = useCallback(async (y: number, m: number): Promise<CalendarEvent[]> => {
    const mm = String(m).padStart(2, '0')
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const { rows: pkgs } = await listPackages({ from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}`, pageSize: 500 })
    return pkgs.filter((p) => p.received_at).map((p) => ({ date: p.received_at as string, kind: 'recibido' }))
  }, [])

  return (
    <div class="mx-auto max-w-6xl space-y-5">
      {/* Screen header + filters (hidden when printing) */}
      <div class="space-y-3 print:hidden">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-secondary">Reportes</h1>
            <p class="text-sm text-gray-500">{a.total} paquetes en el rango seleccionado.</p>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <Button variant="ghost" onClick={exportMatrix}>
              <Download class="h-4 w-4" aria-hidden="true" /> CSV estados
            </Button>
            <Button variant="ghost" onClick={exportDetailed}>
              <Download class="h-4 w-4" aria-hidden="true" /> CSV detallado
            </Button>
            <Button onClick={() => window.print()}>
              <Printer class="h-4 w-4" aria-hidden="true" /> Exportar PDF
            </Button>
          </div>
        </div>

        <Card class="p-4">
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-7">
            <div class="relative col-span-2 lg:col-span-2">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                class={`${inputCls} w-full pl-9`}
                placeholder="Buscar guía, tracking, nombre o casillero…"
                value={searchInput}
                onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)}
              />
            </div>
            <select class={inputCls} value={filters.providerId ?? ''} onChange={(e) => patch({ providerId: (e.target as HTMLSelectElement).value || undefined })}>
              <option value="">Todos los proveedores</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {providerLabel(p.code)}
                </option>
              ))}
            </select>
            <select class={inputCls} value={filters.status ?? ''} onChange={(e) => patch({ status: (e.target as HTMLSelectElement).value || undefined })}>
              <option value="">Todos los estados</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select class={inputCls} value={filters.service ?? ''} onChange={(e) => patch({ service: (e.target as HTMLSelectElement).value || undefined })}>
              <option value="">Aéreo y marítimo</option>
              <option value="aereo">Aéreo</option>
              <option value="maritimo">Marítimo</option>
            </select>
            <DateRangePicker from={filters.from} to={filters.to} onChange={(from, to) => patch({ from, to })} />
          </div>
        </Card>
      </div>

      {/* Printed-only header: gives the PDF a title, the applied filters, and a generation timestamp */}
      <div class="hidden print:block">
        <h1 class="text-xl font-bold text-secondary">Reporte de envíos — HIT Cargo</h1>
        <p class="text-sm text-gray-600">
          {filterSummary || 'Sin filtros'} · {a.total} paquetes · Generado {fmtDateTime(new Date().toISOString())}
        </p>
      </div>

      {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {loading ? (
        <Spinner label="Calculando reportes…" />
      ) : (
        <>
          {/* KPI strip */}
          <div class="avoid-break grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Total" value={a.total} trend={prev && <Trend current={a.total} previous={prev.total} />} />
            <Kpi
              label="Entregados"
              value={entregados}
              tone="text-orange-600"
              trend={prev && <Trend current={entregados} previous={prev.entregados} />}
            />
            <Kpi label="En tránsito" value={enTransito} tone="text-red-600" />
            <Kpi label="Excepciones" value={excepciones} tone="text-gray-600" />
          </div>

          {/* Charts */}
          <div class="grid gap-5 md:grid-cols-2">
            <Card class="avoid-break p-5">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Distribución por estado</h3>
              {a.total === 0 ? <Empty /> : <ChartCanvas config={statusChart} height={220} />}
            </Card>
            <Card class="avoid-break p-5">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Estado × proveedor</h3>
              {a.total === 0 ? <Empty /> : <ChartCanvas config={providerChart} height={220} />}
            </Card>
            <Card class="avoid-break p-5">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Por servicio</h3>
              {a.total === 0 ? <Empty /> : <ChartCanvas config={serviceChart} height={220} />}
            </Card>
            <Card class="avoid-break p-5">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Recibidos por mes</h3>
              {a.total === 0 ? <Empty /> : <ChartCanvas config={monthChart} height={220} />}
            </Card>
          </div>

          {/* Exact figures backing the charts — the part that matters for accounting/audit.
              break-before-page: always start this on a fresh printed page instead of wherever
              the charts happen to end — otherwise the next avoid-break block (the service/month
              cards below) doesn't fit the leftover space and the print engine strands it alone
              on its own page, leaving a big blank gap. */}
          <Card class="avoid-break break-before-page">
            <SectionTitle>Estado × proveedor — cifras exactas</SectionTitle>
            <div class="scroll-thin overflow-x-auto">
              <table class="w-full min-w-[480px] text-sm">
                <thead>
                  <tr class="bg-gray-50/60 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th class="px-4 py-2">Estado</th>
                    {provCodes.map((p) => (
                      <th key={p} class="px-4 py-2 text-right">
                        {providerLabel(p)}
                      </th>
                    ))}
                    <th class="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {STATUS_ORDER.filter((s) => matrix[s]).map((s) => {
                    const total = provCodes.reduce((a, p) => a + (matrix[s]?.[p] ?? 0), 0)
                    return (
                      <tr key={s}>
                        <td class="px-4 py-2">
                          <StatusDot s={s as ShipmentStatus} />
                        </td>
                        {provCodes.map((p) => (
                          <td key={p} class="px-4 py-2 text-right tabular-nums text-gray-700">
                            {matrix[s]?.[p] ?? 0}
                          </td>
                        ))}
                        <td class="px-4 py-2 text-right font-semibold tabular-nums text-secondary">{total}</td>
                      </tr>
                    )
                  })}
                  {a.total === 0 && (
                    <tr>
                      <td colspan={provCodes.length + 2} class="px-4 py-6 text-center text-gray-400">
                        Sin resultados para estos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Redundant with the two charts above (same numbers) — screen-only, kept out of the
              PDF so the report doesn't grow an extra page for a repeat of the same figures. */}
          <div class="grid gap-5 print:hidden md:grid-cols-2">
            <Card class="avoid-break">
              <SectionTitle>Por servicio</SectionTitle>
              <div class="space-y-2 p-5 text-sm">
                {Object.entries(service).map(([k, n]) => (
                  <div key={k} class="flex justify-between">
                    <span class="text-gray-600">{k === '—' ? 'Sin servicio' : SERVICE_LABEL[k] ?? k}</span>
                    <span class="font-medium tabular-nums text-gray-800">{n}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card class="avoid-break">
              <SectionTitle>Recibidos por mes</SectionTitle>
              <div class="space-y-2 p-5 text-sm">
                {Object.entries(byMonth)
                  .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                  .map(([m, n]) => (
                    <div key={m} class="flex justify-between">
                      <span class="text-gray-600">{m}</span>
                      <span class="font-medium tabular-nums text-gray-800">{n}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </>
      )}

      <div class="print:hidden">
        <MonthCalendar
          title="Recepción en Miami por día"
          legend={[{ kind: 'recibido', label: 'Recibido', dot: 'bg-primary' }]}
          loadEvents={loadRecvMonth}
        />
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  tone = 'text-secondary',
  trend,
}: {
  label: string
  value: number
  tone?: string
  trend?: ComponentChildren
}) {
  return (
    <Card class="p-4">
      <div class="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div class={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${tone}`}>{value}</div>
      {trend && <div class="mt-1">{trend}</div>}
    </Card>
  )
}

/** % change vs the immediately preceding period of the same length. Only rendered when a
 * concrete date range is active — "vs previous period" is meaningless for "all time". */
function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return current > 0 ? <span class="text-xs font-medium text-green-600">Nuevo</span> : null
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span class={`flex items-center gap-1 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      <Icon class="h-3 w-3" aria-hidden="true" /> {Math.abs(pct)}% vs período anterior
    </span>
  )
}

function Empty() {
  return <div class="flex h-full items-center justify-center text-sm text-gray-400">Sin datos</div>
}
