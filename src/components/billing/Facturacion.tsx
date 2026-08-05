import { CalendarClock, Download, FileText, Plus, RefreshCw, Search } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { billingApi, type FreightType, type InvoiceFilters, type InvoiceListRow, type InvoiceStatus, type MonthlyClose } from '../../lib/billing'
import { downloadCSV, fmtDate, fmtUsd, INVOICE_STATUS_LABEL, INVOICE_STATUS_ORDER, INVOICE_STATUS_SOFT, toCSV } from '../../lib/format'
import type { Role } from '../../lib/types'
import { Button, Card, IconButton, inputCls, SectionTitle, Spinner } from '../ui'
import { InvoiceDaysBadge } from './badges'
import BillingReports from './BillingReports'
import ExceptionsView from './Exceptions'
import InvoiceDetail from './InvoiceDetail'
import InvoiceForm from './InvoiceForm'

type Tab = 'facturas' | 'reportes' | 'excepciones'
const TABS: { key: Tab; label: string }[] = [
  { key: 'facturas', label: 'Facturas' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'excepciones', label: 'Excepciones' },
]

const PAGE_SIZE = 25

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const keep = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

export default function Facturacion({ role }: { role: Role }) {
  const canWrite = role === 'admin' || role === 'billing'
  const [tab, setTab] = useState<Tab>('facturas')
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<InvoiceFilters>({})
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<InvoiceListRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  // Monthly close panel
  const now = new Date()
  const [closeYear, setCloseYear] = useState(now.getUTCFullYear())
  const [closeMonth, setCloseMonth] = useState(now.getUTCMonth() + 1)
  const [close, setClose] = useState<MonthlyClose | null>(null)
  const [closeBusy, setCloseBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }))
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  function reload() {
    let cancelled = false
    setLoading(true)
    setErr(null)
    billingApi
      .listInvoices({ ...filters, page, pageSize: PAGE_SIZE })
      .then((r) => {
        if (cancelled) return
        setRows(r.rows)
        setCount(r.count)
      })
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : 'No se pudieron cargar las facturas.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }
  useEffect(reload, [filters, page])

  function patch(p: Partial<InvoiceFilters>) {
    setFilters((f) => ({ ...f, ...p }))
    setPage(1)
  }

  async function doExport() {
    try {
      const { rows: all } = await billingApi.listInvoices({ ...filters, page: 1, pageSize: 500 })
      const cols = [
        { key: 'invoiceNumber', label: 'Factura' },
        { key: 'fiscalYear', label: 'Año' },
        { key: 'clientName', label: 'Cliente' },
        { key: 'issueDate', label: 'Fecha' },
        { key: 'status', label: 'Estado' },
        { key: 'total', label: 'Total USD' },
        { key: 'paidUsd', label: 'Pagado USD' },
        { key: 'outstanding', label: 'Saldo USD' },
      ]
      downloadCSV(`facturas-hit-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(all as unknown as Record<string, unknown>[], cols))
    } catch {
      setErr('No se pudo exportar.')
    }
  }

  async function runClose() {
    setCloseBusy(true)
    try {
      setClose(await billingApi.closeMonth(closeYear, closeMonth))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cerrar el mes.')
    } finally {
      setCloseBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-bold text-secondary">Facturación</h1>
        <div class="flex gap-2">
          <IconButton label="Actualizar" onClick={reload} disabled={loading}>
            <RefreshCw class={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </IconButton>
          <Button variant="ghost" onClick={doExport}><Download class="h-4 w-4" /> CSV</Button>
          {canWrite && <Button onClick={() => setShowForm(true)}><Plus class="h-4 w-4" /> Nueva factura</Button>}
        </div>
      </div>

      <div class="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            class={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reportes' && <BillingReports />}
      {tab === 'excepciones' && <ExceptionsView onOpen={setDetailId} />}

      {tab === 'facturas' && (
        <div class="space-y-4">
      {/* Filters */}
      <Card class="p-3">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div class="relative">
            <Search class="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <input class={`${inputCls} w-full pl-8`} placeholder="Buscar cliente…" value={searchInput} onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)} />
          </div>
          <select class={inputCls} value={filters.status ?? ''} onChange={(e) => patch({ status: ((e.target as HTMLSelectElement).value || undefined) as InvoiceStatus | undefined })}>
            <option value="">Todos los estados</option>
            {INVOICE_STATUS_ORDER.map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>)}
          </select>
          <select class={inputCls} value={filters.freightType ?? ''} onChange={(e) => patch({ freightType: ((e.target as HTMLSelectElement).value || undefined) as FreightType | undefined })}>
            <option value="">Todo flete</option>
            <option value="AIR">Aéreo</option>
            <option value="MAR">Marítimo</option>
          </select>
          <select class={inputCls} value={filters.fiscalYear ?? ''} onChange={(e) => patch({ fiscalYear: (e.target as HTMLSelectElement).value ? Number((e.target as HTMLSelectElement).value) : undefined })}>
            <option value="">Todo año</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <div class="flex gap-1">
            <input type="date" class={`${inputCls} w-full`} value={filters.from ?? ''} onInput={(e) => patch({ from: (e.target as HTMLInputElement).value || undefined })} />
            <input type="date" class={`${inputCls} w-full`} value={filters.to ?? ''} onInput={(e) => patch({ to: (e.target as HTMLInputElement).value || undefined })} />
          </div>
        </div>
      </Card>

      {/* Monthly close */}
      <Card class="p-3">
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex items-center gap-2 text-sm font-medium text-gray-600"><CalendarClock class="h-4 w-4" /> Cierre mensual</div>
          <input type="number" class={`${inputCls} w-24`} value={closeYear} onInput={(e) => setCloseYear(Number((e.target as HTMLInputElement).value))} />
          <select class={inputCls} value={closeMonth} onChange={(e) => setCloseMonth(Number((e.target as HTMLSelectElement).value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button variant="ghost" onClick={runClose} disabled={closeBusy}>{closeBusy ? <Spinner /> : 'Calcular'}</Button>
          {close && (
            <div class="flex flex-wrap gap-4 text-sm">
              <span><span class="text-gray-400">Facturas </span><b>{close.invoices}</b></span>
              <span><span class="text-gray-400">Ingresos </span><b>{fmtUsd(close.revenue)}</b></span>
              <span><span class="text-gray-400">Ganancia </span><b class="text-green-700">{fmtUsd(close.profit)}</b></span>
              <span><span class="text-gray-400">Por cobrar </span><b class="text-yellow-700">{fmtUsd(close.receivables)}</b></span>
              <span class="text-gray-400">✈️ {fmtUsd(close.byFreight.AIR.revenue)} · 🚢 {fmtUsd(close.byFreight.MAR.revenue)}</span>
            </div>
          )}
        </div>
      </Card>

      {err && <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {/* List */}
      <Card>
        <SectionTitle class="justify-between">
          <span class="flex items-center gap-2"><FileText class="h-4 w-4" /> {count} facturas</span>
        </SectionTitle>
        {loading ? (
          <div class="p-6"><Spinner label="Cargando facturas…" /></div>
        ) : rows.length === 0 ? (
          <div class="p-6 text-sm text-gray-400">No hay facturas para estos filtros.</div>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th class="px-4 py-2">Factura</th>
                  <th class="px-4 py-2">Cliente</th>
                  <th class="px-4 py-2">Fecha</th>
                  <th class="px-4 py-2">Estado</th>
                  <th class="px-4 py-2 text-right">Total</th>
                  <th class="px-4 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} class="cursor-pointer border-b border-gray-50 hover:bg-gray-50" onClick={() => setDetailId(r.id)}>
                    <td class="px-4 py-2 font-medium text-secondary">#{r.invoiceNumber}<span class="ml-1 text-[11px] text-gray-400">{r.fiscalYear}</span></td>
                    <td class="px-4 py-2">{r.clientName ?? '—'}</td>
                    <td class="px-4 py-2 text-gray-500">
                      <span class="flex items-center gap-1.5">{fmtDate(r.issueDate)}<InvoiceDaysBadge issueDate={r.issueDate} paidAt={r.paidAt} status={r.status} /></span>
                    </td>
                    <td class="px-4 py-2"><span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVOICE_STATUS_SOFT[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{INVOICE_STATUS_LABEL[r.status] ?? r.status}</span></td>
                    <td class="px-4 py-2 text-right font-medium">{fmtUsd(r.total)}</td>
                    <td class="px-4 py-2 text-right">{r.outstanding > 0 ? <span class="text-yellow-700">{fmtUsd(r.outstanding)}</span> : <span class="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div class="flex items-center justify-center gap-1 border-t border-gray-100 p-3">
            {pageWindow(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} class="px-2 text-gray-400">…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)} class={`h-8 w-8 rounded-lg text-sm ${p === page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ),
            )}
          </div>
        )}
      </Card>
        </div>
      )}

      {showForm && (
        <InvoiceForm
          onClose={() => setShowForm(false)}
          onCreated={(v) => {
            setShowForm(false)
            setDetailId(v.id)
            reload()
          }}
        />
      )}
      {detailId && <InvoiceDetail id={detailId} canWrite={canWrite} onClose={() => setDetailId(null)} onChanged={reload} />}
    </div>
  )
}
