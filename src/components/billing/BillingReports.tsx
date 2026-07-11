import { useCallback, useEffect, useState } from 'preact/hooks'
import { billingApi, type YearReport } from '../../lib/billing'
import { BRAND_HEX, fmtUsd } from '../../lib/format'
import ChartCanvas from '../charts/ChartCanvas'
import MonthCalendar, { type CalendarEvent } from '../MonthCalendar'
import { Card, SectionTitle, Spinner } from '../ui'

function monthRange(y: number, m: number): { from: string; to: string } {
  const mm = String(m).padStart(2, '0')
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` }
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card class="p-4">
      <div class="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div class={`mt-1 text-xl font-bold ${accent ?? 'text-secondary'}`}>{value}</div>
    </Card>
  )
}

export default function BillingReports() {
  const [year, setYear] = useState(new Date().getUTCFullYear())
  const [rep, setRep] = useState<YearReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const loadBillingMonth = useCallback(async (y: number, m: number): Promise<CalendarEvent[]> => {
    const { from, to } = monthRange(y, m)
    const { rows } = await billingApi.listInvoices({ from, to, pageSize: 500 })
    const ev: CalendarEvent[] = []
    for (const r of rows) {
      if (r.issueDate) ev.push({ date: r.issueDate, kind: 'facturado' })
      if (r.status === 'PAID' && r.paidAt) ev.push({ date: r.paidAt, kind: 'pagado' })
    }
    return ev
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    billingApi
      .reports(year)
      .then((r) => !cancelled && setRep(r))
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : 'No se pudieron cargar los reportes.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [year])

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-600">Año</span>
        <select class="rounded-lg border border-gray-200 px-2 py-1 text-sm" value={year} onChange={(e) => setYear(Number((e.target as HTMLSelectElement).value))}>
          {[2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <Spinner label="Cargando reportes…" />}
      {err && <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {rep && (
        <>
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Ingresos" value={fmtUsd(rep.revenue)} />
            <Kpi label="Ganancia" value={fmtUsd(rep.profit)} accent="text-green-700" />
            <Kpi label="Por cobrar" value={fmtUsd(rep.receivables)} accent="text-yellow-700" />
            <Kpi label="Facturas" value={String(rep.invoices)} />
          </div>

          <Card>
            <SectionTitle>Ingresos y ganancia por mes</SectionTitle>
            <div class="p-4">
              <ChartCanvas
                height={280}
                config={{
                  type: 'bar',
                  data: {
                    labels: MONTHS,
                    datasets: [
                      { label: 'Ingresos', data: rep.byMonth.map((m) => m.revenue), backgroundColor: BRAND_HEX.primary },
                      { label: 'Ganancia', data: rep.byMonth.map((m) => m.profit), backgroundColor: BRAND_HEX.accentBlue },
                    ],
                  },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
                }}
              />
            </div>
          </Card>

          <Card>
            <SectionTitle>Ingresos por tipo de flete</SectionTitle>
            <div class="p-4">
              <ChartCanvas
                height={240}
                config={{
                  type: 'doughnut',
                  data: {
                    labels: ['Aéreo', 'Marítimo'],
                    datasets: [{ data: [rep.byFreight.AIR.revenue, rep.byFreight.MAR.revenue], backgroundColor: [BRAND_HEX.primary, BRAND_HEX.accentBlue] }],
                  },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
                }}
              />
            </div>
          </Card>
        </>
      )}

      <MonthCalendar
        title="Calendario de facturación"
        legend={[
          { kind: 'facturado', label: 'Facturado', dot: 'bg-primary' },
          { kind: 'pagado', label: 'Pagado', dot: 'bg-green-500' },
        ]}
        loadEvents={loadBillingMonth}
      />
    </div>
  )
}
