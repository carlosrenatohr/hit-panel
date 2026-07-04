import type { ChartConfiguration } from 'chart.js'
import { Download, Printer } from 'lucide-preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
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
import { exportPackages } from '../lib/insforge'
import type { Pkg, ShipmentStatus } from '../lib/types'
import ChartCanvas from './charts/ChartCanvas'
import { Button, Card, inputCls, SectionTitle, Spinner, StatusDot } from './ui'

const BASE_FONT = { family: 'Inter, system-ui, sans-serif', size: 12 }

export default function Reports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<Pkg[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    exportPackages({ from: from || undefined, to: to || undefined }, 5000)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setErr('No se pudieron cargar los datos.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [from, to])

  const agg = useMemo(() => {
    const providers = Array.from(new Set(rows.map((r) => r.providers?.code ?? 'desconocido'))).sort()
    const matrix: Record<string, Record<string, number>> = {}
    const byStatus: Record<string, number> = {}
    const service: Record<string, number> = { aereo: 0, maritimo: 0, '—': 0 }
    const byMonth: Record<string, number> = {}
    for (const r of rows) {
      const s = r.effective_status
      const pc = r.providers?.code ?? 'desconocido'
      matrix[s] = matrix[s] || {}
      matrix[s][pc] = (matrix[s][pc] ?? 0) + 1
      byStatus[s] = (byStatus[s] ?? 0) + 1
      const svc = r.service_type ?? '—'
      service[svc] = (service[svc] ?? 0) + 1
      const m = r.received_at ? r.received_at.slice(0, 7) : '—'
      byMonth[m] = (byMonth[m] ?? 0) + 1
    }
    return {
      providers,
      matrix,
      byStatus,
      service,
      byMonth,
      entregados: byStatus.entregado ?? 0,
      enTransito: byStatus.en_transito ?? 0,
      excepciones: byStatus.excepcion ?? 0,
    }
  }, [rows])

  // ── Chart configs (Chart.js, vanilla — no React coupling, works identically in Preact) ──────
  const statusChart: ChartConfiguration = useMemo(() => {
    const entries = STATUS_ORDER.filter((s) => agg.byStatus[s]).map((s) => [s, agg.byStatus[s]] as const)
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
  }, [agg])

  const providerChart: ChartConfiguration = useMemo(() => {
    const statuses = STATUS_ORDER.filter((s) => agg.matrix[s])
    return {
      type: 'bar',
      data: {
        labels: statuses.map((s) => STATUS_LABEL[s]),
        datasets: agg.providers.map((p) => ({
          label: providerLabel(p),
          data: statuses.map((s) => agg.matrix[s]?.[p] ?? 0),
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
  }, [agg])

  const serviceChart: ChartConfiguration = useMemo(() => {
    const entries = [
      ['aereo', agg.service.aereo, BRAND_HEX.accentBlue],
      ['maritimo', agg.service.maritimo, BRAND_HEX.accentYellow],
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
  }, [agg])

  const monthChart: ChartConfiguration = useMemo(() => {
    const months = Object.keys(agg.byMonth).filter((m) => m !== '—').sort()
    return {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Paquetes recibidos',
            data: months.map((m) => agg.byMonth[m]),
            borderColor: BRAND_HEX.accentBlue,
            backgroundColor: `${BRAND_HEX.accentBlue}22`,
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
  }, [agg])

  function exportMatrix() {
    const cols = [{ key: 'estado', label: 'Estado' }, ...agg.providers.map((p) => ({ key: p, label: providerLabel(p) })), { key: 'total', label: 'Total' }]
    const data = STATUS_ORDER.filter((s) => agg.matrix[s]).map((s) => {
      const row: Record<string, unknown> = { estado: STATUS_LABEL[s] }
      let total = 0
      for (const p of agg.providers) {
        const n = agg.matrix[s]?.[p] ?? 0
        row[p] = n
        total += n
      }
      row.total = total
      return row
    })
    downloadCSV(`reporte-estados-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data, cols))
  }

  function exportDetailed() {
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
    const flat = rows.map((p) => ({ ...p, provider: providerLabel(p.providers?.code) }))
    downloadCSV(`reporte-detallado-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(flat, cols))
  }

  return (
    <div class="mx-auto max-w-6xl space-y-5">
      {/* Screen header + filters (hidden when printing) */}
      <div class="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-secondary">Reportes</h1>
          <p class="text-sm text-gray-500">{rows.length} paquetes en el rango seleccionado.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <label class="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Desde
            <input type="date" class={inputCls} value={from} onChange={(e) => setFrom((e.target as HTMLInputElement).value)} />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Hasta
            <input type="date" class={inputCls} value={to} onChange={(e) => setTo((e.target as HTMLInputElement).value)} />
          </label>
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

      {/* Printed-only header: gives the PDF a title, the filter range, and a generation timestamp */}
      <div class="hidden print:block">
        <h1 class="text-xl font-bold text-secondary">Reporte de envíos — HIT Cargo</h1>
        <p class="text-sm text-gray-600">
          Rango: {from || 'inicio'} – {to || 'hoy'} · {rows.length} paquetes · Generado {fmtDateTime(new Date().toISOString())}
        </p>
      </div>

      {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {loading ? (
        <Spinner label="Calculando reportes…" />
      ) : (
        <>
          {/* KPI strip */}
          <div class="avoid-break grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Total" value={rows.length} />
            <Kpi label="Entregados" value={agg.entregados} tone="text-orange-600" />
            <Kpi label="En tránsito" value={agg.enTransito} tone="text-red-600" />
            <Kpi label="Excepciones" value={agg.excepciones} tone="text-gray-600" />
          </div>

          {/* Charts */}
          <div class="grid gap-5 md:grid-cols-2">
            <Card class="avoid-break p-5">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Distribución por estado</h3>
              <ChartCanvas config={statusChart} height={220} />
            </Card>
            <Card class="avoid-break p-5">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Estado × proveedor</h3>
              <ChartCanvas config={providerChart} height={220} />
            </Card>
            <Card class="avoid-break p-5">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Por servicio</h3>
              <ChartCanvas config={serviceChart} height={220} />
            </Card>
            <Card class="avoid-break p-5">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Recibidos por mes</h3>
              <ChartCanvas config={monthChart} height={220} />
            </Card>
          </div>

          {/* Exact figures backing the charts — the part that matters for accounting/audit */}
          <Card class="avoid-break">
            <SectionTitle>Estado × proveedor — cifras exactas</SectionTitle>
            <div class="scroll-thin overflow-x-auto">
              <table class="w-full min-w-[480px] text-sm">
                <thead>
                  <tr class="bg-gray-50/60 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th class="px-4 py-2">Estado</th>
                    {agg.providers.map((p) => (
                      <th key={p} class="px-4 py-2 text-right">
                        {providerLabel(p)}
                      </th>
                    ))}
                    <th class="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {STATUS_ORDER.filter((s) => agg.matrix[s]).map((s) => {
                    const total = agg.providers.reduce((a, p) => a + (agg.matrix[s]?.[p] ?? 0), 0)
                    return (
                      <tr key={s}>
                        <td class="px-4 py-2">
                          <StatusDot s={s as ShipmentStatus} />
                        </td>
                        {agg.providers.map((p) => (
                          <td key={p} class="px-4 py-2 text-right tabular-nums text-gray-700">
                            {agg.matrix[s]?.[p] ?? 0}
                          </td>
                        ))}
                        <td class="px-4 py-2 text-right font-semibold tabular-nums text-secondary">{total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div class="grid gap-5 md:grid-cols-2">
            <Card class="avoid-break">
              <SectionTitle>Por servicio</SectionTitle>
              <div class="space-y-2 p-5 text-sm">
                {Object.entries(agg.service).map(([k, n]) => (
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
                {Object.entries(agg.byMonth)
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
    </div>
  )
}

function Kpi({ label, value, tone = 'text-secondary' }: { label: string; value: number; tone?: string }) {
  return (
    <Card class="p-4">
      <div class="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div class={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${tone}`}>{value}</div>
    </Card>
  )
}
