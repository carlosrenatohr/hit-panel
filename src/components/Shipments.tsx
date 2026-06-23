import { useEffect, useState } from 'preact/hooks'
import {
  daysAgo,
  downloadCSV,
  fmtDate,
  fmtDateTime,
  providerLabel,
  SERVICE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  statusLabel,
  toCSV,
} from '../lib/format'
import { exportPackages, getProviders, listPackages } from '../lib/insforge'
import type { ListFilters } from '../lib/insforge'
import type { Pkg, Provider, ShipmentStatus } from '../lib/types'
import { Button, Card, inputCls, Spinner, StatusPill } from './ui'

const PAGE_SIZE = 25
const SORTS: { col: string; label: string }[] = [
  { col: 'received_at', label: 'Recibido' },
  { col: 'last_event_at', label: 'Último evento' },
  { col: 'scraped_at', label: 'Actualizado' },
  { col: 'almacen_id', label: 'Guía' },
]

export default function Shipments({ onOpen }: { onOpen: (guia: string) => void }) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<ListFilters>({ sortCol: 'received_at', ascending: false })
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Pkg[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getProviders().then(setProviders).catch(() => {})
  }, [])

  // Debounce the search box into the applied filters.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }))
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    listPackages({ ...filters, page, pageSize: PAGE_SIZE })
      .then((r) => {
        if (cancelled) return
        setRows(r.rows)
        setCount(r.count)
      })
      .catch(() => !cancelled && setErr('No se pudieron cargar los envíos.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters, page])

  function patch(p: Partial<ListFilters>) {
    setFilters((f) => ({ ...f, ...p }))
    setPage(1)
  }

  async function doExport() {
    setExporting(true)
    try {
      const data = await exportPackages(filters, 2000)
      const cols = [
        { key: 'almacen_id', label: 'Guia' },
        { key: 'tracking_number', label: 'Tracking' },
        { key: 'provider', label: 'Proveedor' },
        { key: 'effective_status', label: 'Estado' },
        { key: 'service_type', label: 'Servicio' },
        { key: 'pieces', label: 'Piezas' },
        { key: 'weight_lb', label: 'Peso (lb)' },
        { key: 'origin_office', label: 'Origen' },
        { key: 'dest_office', label: 'Destino' },
        { key: 'received_at', label: 'Recibido' },
        { key: 'last_event_at', label: 'Ultimo evento' },
      ]
      const flat = data.map((p) => ({ ...p, provider: providerLabel(p.providers?.code) }))
      downloadCSV(`envios-hit-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(flat, cols))
    } catch {
      setErr('No se pudo exportar.')
    } finally {
      setExporting(false)
    }
  }

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div class="mx-auto max-w-7xl space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-secondary">Envíos</h1>
          <p class="text-sm text-slate-500">{count} resultados</p>
        </div>
        <Button variant="ghost" onClick={doExport} disabled={exporting}>
          {exporting ? 'Exportando…' : '⬇︎ Exportar CSV'}
        </Button>
      </div>

      {/* Filters */}
      <Card class="p-4">
        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <input
            class={`${inputCls} lg:col-span-2`}
            placeholder="Buscar guía, tracking o casillero…"
            value={searchInput}
            onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)}
          />
          <select class={inputCls} onChange={(e) => patch({ providerId: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">Todos los proveedores</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {providerLabel(p.code)}
              </option>
            ))}
          </select>
          <select class={inputCls} onChange={(e) => patch({ status: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">Todos los estados</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select class={inputCls} onChange={(e) => patch({ service: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">Aéreo y marítimo</option>
            <option value="aereo">Aéreo</option>
            <option value="maritimo">Marítimo</option>
          </select>
          <select
            class={inputCls}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value
              const [col, dir] = v.split(':')
              patch({ sortCol: col, ascending: dir === 'asc' })
            }}
          >
            {SORTS.map((s) => (
              <option key={s.col} value={`${s.col}:desc`}>
                {s.label} ↓
              </option>
            ))}
          </select>
          <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Desde
            <input type="date" class={inputCls} onChange={(e) => patch({ from: (e.target as HTMLInputElement).value || undefined })} />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Hasta
            <input type="date" class={inputCls} onChange={(e) => patch({ to: (e.target as HTMLInputElement).value || undefined })} />
          </label>
        </div>
      </Card>

      {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {/* Table */}
      <Card>
        <div class="scroll-thin overflow-x-auto">
          <table class="w-full min-w-[860px] text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3">Guía</th>
                <th class="px-4 py-3">Proveedor</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Servicio</th>
                <th class="px-4 py-3">Pzs</th>
                <th class="px-4 py-3">Ruta</th>
                <th class="px-4 py-3">Recibido</th>
                <th class="px-4 py-3">Últ. evento</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colspan={8} class="px-4 py-10">
                    <Spinner />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colspan={8} class="px-4 py-10 text-center text-slate-400">
                    Sin resultados para estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
                  const stale = daysAgo(p.last_event_at)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onOpen(p.almacen_id)}
                      class="cursor-pointer border-b border-slate-100 hover:bg-primary/5"
                    >
                      <td class="px-4 py-3 font-semibold text-secondary">{p.almacen_id}</td>
                      <td class="px-4 py-3 text-slate-600">{providerLabel(p.providers?.code)}</td>
                      <td class="px-4 py-3">
                        <StatusPill s={p.effective_status as ShipmentStatus} />
                      </td>
                      <td class="px-4 py-3 text-slate-600">{p.service_type ? SERVICE_LABEL[p.service_type] : '—'}</td>
                      <td class="px-4 py-3 text-slate-600">{p.pieces ?? '—'}</td>
                      <td class="px-4 py-3 text-slate-600">
                        {(p.origin_office ?? '—') + ' → ' + (p.dest_office ?? '—')}
                      </td>
                      <td class="px-4 py-3 text-slate-600">{fmtDate(p.received_at)}</td>
                      <td class="px-4 py-3 text-slate-600">
                        {fmtDate(p.last_event_at)}
                        {stale !== null && stale > 10 && p.effective_status !== 'entregado' && (
                          <span class="ml-1 text-[10px] text-red-500">⚠ {stale}d</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div class="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
          <span class="text-slate-500">
            Página {page} de {pages}
          </span>
          <div class="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Anterior
            </Button>
            <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Siguiente →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
