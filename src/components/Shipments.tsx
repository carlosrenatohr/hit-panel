import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { cleanName, downloadCSV, isHazmat, providerLabel, STATUS_LABEL, STATUS_ORDER, toCSV } from '../lib/format'
import { exportPackages, getProviders, listPackages } from '../lib/insforge'
import type { ListFilters } from '../lib/insforge'
import type { Pkg, Provider } from '../lib/types'
import { COLUMN_DEFS, ColumnPicker, useColumnPrefs } from './ShipmentColumns'
import { Button, Card, inputCls, Spinner } from './ui'

const PAGE_SIZE = 25
const SORTS: { col: string; label: string }[] = [
  { col: 'received_at', label: 'Recibido' },
  { col: 'last_event_at', label: 'Último evento' },
  { col: 'scraped_at', label: 'Actualizado' },
  { col: 'almacen_id', label: 'Guía' },
  { col: 'referencia_name', label: 'Nombre' },
  { col: 'tracking_number', label: 'Tracking' },
  { col: 'effective_status', label: 'Estado' },
  { col: 'service_type', label: 'Servicio' },
  { col: 'weight_lb', label: 'Peso' },
  { col: 'pieces', label: 'Piezas' },
]

export default function Shipments({ onOpen }: { onOpen: (guia: string) => void }) {
  const colPrefs = useColumnPrefs()
  const visibleCols = colPrefs.columns
    .filter((c) => c.visible)
    .map((c) => COLUMN_DEFS.find((d) => d.key === c.key))
    .filter((d): d is (typeof COLUMN_DEFS)[number] => !!d)
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
        { key: 'name', label: 'Nombre' },
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
        { key: 'hazmat', label: 'Hazmat' },
      ]
      const flat = data.map((p) => ({
        ...p,
        provider: providerLabel(p.providers?.code),
        name: cleanName(p.referencia_name),
        hazmat: isHazmat(p.referencia_name) ? 'si' : '',
      }))
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
          <h1 class="text-2xl font-bold tracking-tight text-secondary">Envíos</h1>
          <p class="text-sm text-gray-500">{count} resultados</p>
        </div>
        <div class="flex gap-2">
          <ColumnPicker prefs={colPrefs} />
          <Button variant="ghost" onClick={doExport} disabled={exporting}>
            <Download class="h-4 w-4" aria-hidden="true" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card class="p-4">
        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div class="relative lg:col-span-2">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              class={`${inputCls} w-full pl-9`}
              placeholder="Buscar guía, tracking o casillero…"
              value={searchInput}
              onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)}
            />
          </div>
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
          <label class="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Desde
            <input type="date" class={inputCls} onChange={(e) => patch({ from: (e.target as HTMLInputElement).value || undefined })} />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Hasta
            <input type="date" class={inputCls} onChange={(e) => patch({ to: (e.target as HTMLInputElement).value || undefined })} />
          </label>
        </div>
      </Card>

      {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {/* Table */}
      <Card>
        <div class="scroll-thin overflow-x-auto">
          <table class="w-full min-w-[900px] text-sm">
            <thead>
              <tr class="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th class="px-4 py-3">Guía</th>
                {visibleCols.map((c) => (
                  <th key={c.key} class="px-4 py-3">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colspan={1 + visibleCols.length} class="px-4 py-10">
                    <Spinner />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colspan={1 + visibleCols.length} class="px-4 py-10 text-center text-gray-400">
                    Sin resultados para estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => onOpen(p.almacen_id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(p.almacen_id))}
                    class="cursor-pointer transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <td class="px-4 py-3 font-semibold text-secondary">{p.almacen_id}</td>
                    {visibleCols.map((c) => (
                      <td key={c.key} class="px-4 py-3">
                        {c.render(p)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div class="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
          <span class="text-gray-500">
            Página {page} de {pages}
          </span>
          <div class="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft class="h-4 w-4" aria-hidden="true" /> Anterior
            </Button>
            <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Siguiente <ChevronRight class="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
