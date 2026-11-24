import { CalendarClock, Download, FileText, Plus, RefreshCw, Search } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { billingApi, type DateRangeSummary, type FreightType, type InvoiceFilters, type InvoiceListRow, type InvoiceStatus, type MonthlyClose } from '../../lib/billing'
import { bumpData, useDataVersion, useFetchGate } from '../../lib/dataVersion'
import { downloadCSV, fmtDate, fmtUsd, INVOICE_STATUS_LABEL, INVOICE_STATUS_ORDER, INVOICE_STATUS_SOFT, toCSV } from '../../lib/format'
import type { Role } from '../../lib/types'
import { Button, Card, ConfirmDialog, IconButton, inputCls, SectionTitle, Spinner } from '../ui'
import { SortableHeader } from '../ui/SortableHeader'
import { DEFAULT_PAGE_SIZE, Pagination, type PageSize } from '../ui/Pagination'
import { DateRangePicker } from '../DateRangePicker'
import { InvoiceDaysBadge } from './badges'
import BillingReports from './BillingReports'
import ExceptionsView from './Exceptions'
import InvoiceDetail from './InvoiceDetail'
import InvoiceForm from './InvoiceForm'
import InvoiceRowActions from './InvoiceRowActions'

type Tab = 'facturas' | 'reportes' | 'excepciones'
const TABS: { key: Tab; label: string }[] = [
  { key: 'facturas', label: 'Facturas' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'excepciones', label: 'Excepciones' },
]

// Year options: the current year and the two before it — no hardcoded list to
// bump every January.
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => new Date().getUTCFullYear() - i)

export default function Facturacion({ role }: { role: Role }) {
  const canWrite = role === 'admin' || role === 'billing'
  const [tab, setTab] = useState<Tab>('facturas')
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<InvoiceFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [rows, setRows] = useState<InvoiceListRow[]>([])
  const [count, setCount] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  // Re-invalidates the list on demand (refresh button, row actions) without
  // touching the filters; `dataRev` propagates invoice/package mutations from
  // any view so the list is never stale.
  const [rev, setRev] = useState(0)
  const dataRev = useDataVersion('invoices', 'packages')
  // Gate: refetch del bus con la misma query → swap silencioso, sin spinner.
  const listKey = JSON.stringify([filters, page, pageSize, rev])
  const { loading, begin: beginList, done: doneList } = useFetchGate(listKey)

  const [showForm, setShowForm] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  // Monthly close panel
  const now = new Date()
  const [closeYear, setCloseYear] = useState(now.getUTCFullYear())
  const [closeMonth, setCloseMonth] = useState(now.getUTCMonth() + 1)
  const [close, setClose] = useState<MonthlyClose | null>(null)
  const [closeBusy, setCloseBusy] = useState(false)

  // Date-range summary
  const [summary, setSummary] = useState<DateRangeSummary | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }))
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  function reload() {
    setRev((v) => v + 1)
  }

  // Header sorting: one column at a time, owned by the filters the list query
  // already sends (changing the order returns to page 1, like a filter).
  const activeSort = filters.sort ?? 'invoice_number'
  const activeAscending = filters.ascending ?? false
  const applySort = (field: string, ascending: boolean) => {
    setFilters((f) => ({ ...f, sort: field as InvoiceFilters['sort'], ascending }))
    setPage(1)
  }
  // The default order (newest invoice first) is a real sort too: aria-sort has
  // to describe what the table is actually showing, not just the clicked state.
  const sortState = (field: string): 'ascending' | 'descending' | 'none' =>
    activeSort === field ? (activeAscending ? 'ascending' : 'descending') : 'none'

  // Single fetch pipeline: the effect owns the request, its cleanup cancels the
  // previous in-flight one, so a slow response can never overwrite a newer one.
  useEffect(() => {
    beginList()
    let cancelled = false
    setErr(null)
    billingApi
      .listInvoices({ ...filters, page, pageSize })
      .then((r) => {
        if (cancelled) return
        setRows(r.rows)
        setCount(r.count)
      })
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : 'No se pudieron cargar las facturas.'))
      .finally(() => !cancelled && doneList())
    return () => {
      cancelled = true
    }
  }, [listKey, dataRev, beginList, doneList])

  // Load summary when date range filters change (debounced with reload)
  useEffect(() => {
    const from = filters.from ?? ''
    const to = filters.to ?? ''
    if (!from && !to) { setSummary(null); return }
    let cancelled = false
    billingApi
      .summary(from || '2020-01-01', to || new Date().toISOString().slice(0, 10))
      .then((s) => !cancelled && setSummary(s))
      .catch(() => !cancelled && setSummary(null))
    return () => { cancelled = true }
  }, [filters.from, filters.to, dataRev])

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
      const dateSuffix = filters.from || filters.to ? `-${filters.from ?? 'inicio'}-${filters.to ?? 'fin'}` : ''
      downloadCSV(`facturas${dateSuffix}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(all as unknown as Record<string, unknown>[], cols))
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

  /** Destructive row actions ask through the shared dialog, never window.confirm. */
  const [pending, setPending] = useState<{ kind: 'close' | 'void' | 'archive'; row: InvoiceListRow } | null>(null)

  async function runRowClose(r: InvoiceListRow) {
    setActionId(r.id)
    try {
      const v = await billingApi.closeInvoice(r.id)
      setDetailId(v.id)
      bumpData('invoices')
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cerrar la factura.')
    } finally {
      setActionId(null)
    }
  }

  async function runRowVoid(r: InvoiceListRow) {
    setActionId(r.id)
    try {
      const v = await billingApi.voidInvoice(r.id, 'Anulada desde la lista')
      setDetailId(v.id)
      bumpData('invoices', 'packages')
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo anular la factura.')
    } finally {
      setActionId(null)
    }
  }

  async function runRowArchive(r: InvoiceListRow) {
    setActionId(r.id)
    try {
      await billingApi.archiveInvoice(r.id, 'Archivada desde la lista')
      // -- The archived invoice no longer resolves: close its detail view. --
      if (detailId === r.id) setDetailId(null)
      bumpData('invoices', 'packages')
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo archivar la factura.')
    } finally {
      setActionId(null)
    }
  }


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
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <DateRangePicker from={filters.from} to={filters.to} onChange={(f, t) => patch({ from: f, to: t })} />
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
              <span><span class="text-gray-400">Utilidad </span><b class="text-green-700">{fmtUsd(close.profit)}</b></span>
              <span><span class="text-gray-400">Por cobrar </span><b class="text-yellow-700">{fmtUsd(close.receivables)}</b></span>
              <span class="text-gray-400">✈️ {fmtUsd(close.byFreight.AIR.revenue)} · 🚢 {fmtUsd(close.byFreight.MAR.revenue)}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Date-range summary */}
      {summary && (
        <Card class="p-3">
          <div class="flex flex-wrap items-center gap-6 text-sm">
            <span class="font-medium text-gray-600">Resumen del periodo</span>
            <span><span class="text-gray-400">Facturas </span><b>{summary.invoices}</b></span>
            <span><span class="text-gray-400">Ingresos </span><b>{fmtUsd(summary.revenue)}</b></span>
            <span><span class="text-gray-400">Utilidad </span><b class="text-green-700">{fmtUsd(summary.profit)}</b></span>
            <span><span class="text-gray-400">Por cobrar </span><b class="text-yellow-700">{fmtUsd(summary.receivables)}</b></span>
            <span class="text-gray-400">✈️ {fmtUsd(summary.byFreight.AIR.revenue)} · 🚢 {fmtUsd(summary.byFreight.MAR.revenue)}</span>
          </div>
        </Card>
      )}

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
                  <th class="px-4 py-2" aria-sort={sortState('invoice_number')}>
                    <SortableHeader label="Factura" field="invoice_number" sortCol={activeSort} ascending={activeAscending} onSort={applySort} />
                  </th>
                  <th class="px-4 py-2" aria-sort={sortState('client')}>
                    <SortableHeader label="Cliente" field="client" sortCol={activeSort} ascending={activeAscending} onSort={applySort} />
                  </th>
                  <th class="px-4 py-2" aria-sort={sortState('date')}>
                    <SortableHeader label="Fecha" field="date" sortCol={activeSort} ascending={activeAscending} onSort={applySort} />
                  </th>
                  <th class="px-4 py-2" aria-sort={sortState('status')}>
                    <SortableHeader label="Estado" field="status" sortCol={activeSort} ascending={activeAscending} onSort={applySort} />
                  </th>
                  <th class="px-4 py-2 text-right" aria-sort={sortState('total')}>
                    <SortableHeader label="Total" field="total" sortCol={activeSort} ascending={activeAscending} onSort={applySort} align="end" />
                  </th>
                  <th class="px-4 py-2 text-right">Saldo</th>
                  <th class="px-4 py-2 text-right">Acciones</th>
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
                    <td class="px-4 py-2">
                      <InvoiceRowActions
                        row={r}
                        canWrite={canWrite}
                        busy={actionId === r.id}
                        onView={() => setDetailId(r.id)}
                        onEdit={() => setEditingId(r.id)}
                        onClose={() => setPending({ kind: 'close', row: r })}
                        onVoid={() => setPending({ kind: 'void', row: r })}
                        onArchive={() => setPending({ kind: 'archive', row: r })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          count={count}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          noun={count === 1 ? 'factura' : 'facturas'}
          disabled={loading}
        />
      </Card>
        </div>
      )}

      {showForm && (
        <InvoiceForm
          onClose={() => setShowForm(false)}
          onCreated={(v) => {
            setShowForm(false)
            setDetailId(v.id)
            bumpData('invoices', 'packages')
            reload()
          }}
        />
      )}
      {editingId && (
        <InvoiceForm
          invoiceId={editingId}
          onClose={() => setEditingId(null)}
          onCreated={(v) => {
            setEditingId(null)
            setDetailId(v.id)
            bumpData('invoices', 'packages')
            reload()
          }}
        />
      )}
      {detailId && <InvoiceDetail id={detailId} canWrite={canWrite} onClose={() => setDetailId(null)} onChanged={reload} />}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          const p = pending
          setPending(null)
          if (!p) return
          if (p.kind === 'close') void runRowClose(p.row)
          else if (p.kind === 'void') void runRowVoid(p.row)
          else void runRowArchive(p.row)
        }}
        variant={pending?.kind === 'close' ? 'warning' : 'danger'}
        title={
          pending?.kind === 'close'
            ? 'Cerrar factura'
            : pending?.kind === 'void'
              ? 'Anular factura'
              : 'Archivar factura'
        }
        confirmLabel={pending?.kind === 'close' ? 'Cerrar factura' : pending?.kind === 'void' ? 'Anular factura' : 'Archivar factura'}
        loading={actionId !== null}
        message={
          pending?.kind === 'close'
            ? `¿Cerrar la factura #${pending.row.invoiceNumber}? Pasará de borrador a emitida y sus líneas, montos y guías quedarán bloqueados.`
            : pending?.kind === 'void'
              ? `¿Anular la factura #${pending?.row.invoiceNumber}? Se liberarán los paquetes enlazados y el documento quedará como inválido. No se puede deshacer.`
              : `¿Archivar la factura #${pending?.row.invoiceNumber}? Dejará de aparecer en la lista y reportes, y sus paquetes enlazados se liberarán para volver a facturar. No se puede deshacer.`
        }
      />
    </div>
  )
}
