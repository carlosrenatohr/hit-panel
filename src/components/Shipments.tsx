import { CalendarDays, ChevronLeft, ChevronRight, Download, Pencil, Plus, RefreshCw, Search } from 'lucide-preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import MonthCalendar, { type CalendarEvent } from './MonthCalendar'
import {
  cleanName,
  daysAgo,
  downloadCSV,
  fmtDate,
  isHazmat,
  officeFlag,
  providerLabel,
  SERVICE_EMOJI,
  STATUS_LABEL,
  STATUS_ORDER,
  toCSV,
} from '../lib/format'
import { createPackage, exportPackages, getProviders, listPackages } from '../lib/insforge'
import type { ListFilters } from '../lib/insforge'
import type { Pkg, Provider, ShipmentStatus, SessionUser } from '../lib/types'
import { DateRangePicker } from './DateRangePicker'
import { COLUMN_DEFS, ColumnPicker, useColumnPrefs } from './ShipmentColumns'
import { Button, Card, DaysBadge, Field, HazmatBadge, IconButton, inputCls, Spinner, StaleBadge, StatusDot } from './ui'

const PAGE_SIZE = 25
// `dir` is the direction applied when the option is picked. The default (status_rank asc) puts
// packages ready for pickup in Nicaragua at the top; insforge.ts adds oldest-reception-first as a
// tiebreaker. The rest default to descending (newest/highest first), which reads naturally.
const SORTS: { col: string; label: string; dir: 'asc' | 'desc' }[] = [
  { col: 'status_rank', label: 'Listos para retiro', dir: 'asc' },
  { col: 'received_at', label: 'Recibido', dir: 'desc' },
  { col: 'last_event_at', label: 'Último evento', dir: 'desc' },
  { col: 'scraped_at', label: 'Actualizado', dir: 'desc' },
  { col: 'almacen_id', label: 'Guía', dir: 'desc' },
  { col: 'referencia_name', label: 'Nombre', dir: 'desc' },
  { col: 'tracking_number', label: 'Tracking', dir: 'desc' },
  { col: 'effective_status', label: 'Estado', dir: 'desc' },
  { col: 'service_type', label: 'Servicio', dir: 'desc' },
  { col: 'weight_lb', label: 'Peso', dir: 'desc' },
  { col: 'pieces', label: 'Piezas', dir: 'desc' },
]

// Condensed page list with ellipses — always shows first, last, and a window around the current
// page. Keeps the pager a fixed width no matter how many thousands of packages accumulate.
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

export default function Shipments({ user, onOpen }: { user: SessionUser; onOpen: (guia: string) => void }) {
  const colPrefs = useColumnPrefs()
  const visibleCols = colPrefs.columns
    .filter((c) => c.visible)
    .map((c) => COLUMN_DEFS.find((d) => d.key === c.key))
    .filter((d): d is (typeof COLUMN_DEFS)[number] => !!d)
  // Package writes (create_package RPC) gate on is_writer() = admin|staff.
  const canWrite = user.role === 'admin' || user.role === 'staff'
  const selectedOrg = user.agency // tenant is pinned: a user only sees their own agency
  const [providers, setProviders] = useState<Provider[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState<ListFilters>({ sortCol: 'status_rank', ascending: true })
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Pkg[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showCal, setShowCal] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    almacenId: '',
    trackingNumber: '',
    serviceType: '' as 'aereo' | 'maritimo' | '',
    referenciaName: '',
    weightLb: '',
    pieces: '',
    receivedAt: '',
  })

  // Calendar: packages received per day in the selected month (received_at).
  const loadRecvMonth = useCallback(async (y: number, m: number): Promise<CalendarEvent[]> => {
    const mm = String(m).padStart(2, '0')
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const { rows } = await listPackages({ from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}`, pageSize: 500, organizationId: selectedOrg })
    return rows.filter((p) => p.received_at).map((p) => ({ date: p.received_at as string, kind: 'recibido' }))
  }, [])

  useEffect(() => {
    getProviders(user.agency).then(setProviders).catch(() => {})
  }, [user.agency])

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
    listPackages({ ...filters, page, pageSize: PAGE_SIZE, organizationId: selectedOrg })
      .then((r) => {
        if (cancelled) return
        setRows(r.rows)
        setCount(r.count)
      })
      .catch(() => !cancelled && setErr('No se pudieron cargar los paquetes.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters, page])

  function reload() {
    setLoading(true)
    setErr(null)
    listPackages({ ...filters, page, pageSize: PAGE_SIZE, organizationId: selectedOrg })
      .then((r) => { setRows(r.rows); setCount(r.count) })
      .catch(() => setErr('No se pudieron cargar los paquetes.'))
      .finally(() => setLoading(false))
  }

  function patch(p: Partial<ListFilters>) {
    setFilters((f) => ({ ...f, ...p }))
    setPage(1)
  }

  async function doExport() {
    setExporting(true)
    try {
      const data = await exportPackages({ ...filters, organizationId: selectedOrg }, 2000)
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
      downloadCSV(`paquetes-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(flat, cols))
    } catch {
      setErr('No se pudo exportar.')
    } finally {
      setExporting(false)
    }
  }

  const handleCreatePackage = async () => {
    if (!createForm.almacenId.trim()) {
      setCreateError('La guía es obligatoria.')
      return
    }
    setCreateError(null)
    setCreateLoading(true)
    try {
      await createPackage({
        almacenId: createForm.almacenId.trim(),
        trackingNumber: createForm.trackingNumber || null,
        serviceType: createForm.serviceType || null,
        referenciaName: createForm.referenciaName || null,
        weightLb: createForm.weightLb ? Number(createForm.weightLb) : null,
        pieces: createForm.pieces ? Number(createForm.pieces) : null,
        receivedAt: createForm.receivedAt || null,
      })
      setShowCreate(false)
      setCreateForm({ almacenId: '', trackingNumber: '', serviceType: '', referenciaName: '', weightLb: '', pieces: '', receivedAt: '' })
      reload()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Error al crear el paquete.')
    } finally {
      setCreateLoading(false)
    }
  }

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div class="mx-auto max-w-7xl space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-secondary">Paquetería</h1>
          <p class="text-sm text-gray-500">{count} resultados</p>
        </div>
        <div class="flex gap-2">
          <IconButton label="Actualizar" onClick={reload} disabled={loading}>
            <RefreshCw class={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </IconButton>
          {/* Columns only customize the desktop table; the mobile card layout ignores them. */}
          <span class="hidden md:inline-flex">
            <ColumnPicker prefs={colPrefs} />
          </span>
          <Button variant="ghost" onClick={() => setShowCal((v) => !v)}>
            <CalendarDays class="h-4 w-4" aria-hidden="true" />
            {showCal ? 'Ocultar calendario' : 'Calendario'}
          </Button>
          <Button variant="ghost" onClick={doExport} disabled={exporting}>
            <Download class="h-4 w-4" aria-hidden="true" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Button>
          {canWrite && (
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              <Plus class="h-4 w-4" aria-hidden="true" />
              Crear paquete
            </Button>
          )}
        </div>
      </div>

      {showCal && (
        <MonthCalendar
          title="Recepción en Miami por día"
          legend={[{ kind: 'recibido', label: 'Recibido', dot: 'bg-primary' }]}
          loadEvents={loadRecvMonth}
        />
      )}

      {/* Filters */}
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
            value={`${filters.sortCol}:${filters.ascending ? 'asc' : 'desc'}`}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value
              const [col, dir] = v.split(':')
              patch({ sortCol: col, ascending: dir === 'asc' })
            }}
          >
            {SORTS.map((s) => (
              <option key={s.col} value={`${s.col}:${s.dir}`}>
                {s.label} {s.col === 'status_rank' ? '🎯' : s.dir === 'asc' ? '↑' : '↓'}
              </option>
            ))}
          </select>
          <div class="col-span-2 lg:col-span-1">
            <DateRangePicker from={filters.from} to={filters.to} onChange={(from, to) => patch({ from, to })} />
          </div>
        </div>
      </Card>

      {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {/* List — cards on mobile, table on desktop */}
      <Card>
        {/* Mobile cards */}
        <div class="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <div class="p-6">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <p class="px-4 py-10 text-center text-gray-400">Sin resultados para estos filtros.</p>
          ) : (
            rows.map((p) => {
              const stale = daysAgo(p.last_event_at)
              const showStale = stale !== null && stale > 10 && p.effective_status !== 'entregado'
              const recDays = daysAgo(p.received_at)
              const showRecDays = recDays !== null && p.effective_status !== 'entregado'
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpen(p.almacen_id)}
                  class="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors active:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-semibold text-secondary">{p.almacen_id}</span>
                    <span class="flex items-center gap-1.5">
                      <StatusDot s={p.effective_status as ShipmentStatus} />
                      {p.manual_status && (
                        <span title={`Estado manual: ${p.manual_status}`} class="text-orange-500" aria-label="Estado manual">
                          <Pencil class="h-3 w-3" />
                        </span>
                      )}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 text-sm text-gray-700">
                    <span class="truncate">{cleanName(p.referencia_name)}</span>
                    {isHazmat(p.referencia_name) && <HazmatBadge />}
                    {p.photo_ref && <span title="Tiene foto">🖼️</span>}
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{providerLabel(p.providers?.code)}</span>
                    <span>
                      {p.service_type ? SERVICE_EMOJI[p.service_type] : '—'} {officeFlag(p.origin_office)}
                    </span>
                    <span>
                      {p.pieces ?? '—'} pzs · {p.weight_lb != null ? `${p.weight_lb} lb` : 'peso sin dato'}
                    </span>
                    <span class="ml-auto flex items-center gap-1.5">
                      {fmtDate(p.last_event_at)}
                      {showStale && <StaleBadge days={stale as number} />}
                    </span>
                  </div>
                  {p.received_at && (
                    <div class="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>Recibido Miami: {fmtDate(p.received_at)}</span>
                      {showRecDays && <DaysBadge days={recDays as number} />}
                    </div>
                  )}
                  {p.tracking_number && (
                    <div class="truncate font-mono text-xs text-gray-400">{p.tracking_number}</div>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Desktop table */}
        <div class="scroll-thin hidden overflow-x-auto md:block">
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
        {/* Pagination — numeric, condensed with ellipses */}
        <div class="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-sm">
          <span class="hidden shrink-0 text-gray-500 sm:block">
            {count} resultados · pág. {page}/{pages}
          </span>
          <nav class="flex flex-1 items-center justify-end gap-1" aria-label="Paginación">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Anterior"
              class="rounded-lg px-2 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft class="h-4 w-4" aria-hidden="true" />
            </button>
            {pageWindow(page, pages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} class="px-1.5 text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === page ? 'page' : undefined}
                  class={`min-w-[2rem] rounded-lg px-2 py-1.5 text-center tabular-nums transition-colors ${
                    p === page ? 'bg-primary font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              aria-label="Siguiente"
              class="rounded-lg px-2 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight class="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </Card>

      {/* ── Create Package Modal ── */}
      {showCreate && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 class="text-lg font-semibold text-secondary mb-4">Crear paquete manual</h2>

            {createError && (
              <div class="mb-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{createError}</div>
            )}

            <div class="space-y-3">
              <Field label="Guía (almacén)">
                <input
                  class={inputCls}
                  placeholder="Ej: 25001234"
                  value={createForm.almacenId}
                  onInput={(e) => setCreateForm({ ...createForm, almacenId: (e.target as HTMLInputElement).value })}
                />
              </Field>

              <Field label="Número de tracking">
                <input
                  class={inputCls}
                  placeholder="Opcional"
                  value={createForm.trackingNumber}
                  onInput={(e) => setCreateForm({ ...createForm, trackingNumber: (e.target as HTMLInputElement).value })}
                />
              </Field>

              <Field label="Servicio">
                <select
                  class={inputCls}
                  value={createForm.serviceType}
                  onChange={(e) => setCreateForm({ ...createForm, serviceType: (e.target as HTMLSelectElement).value as 'aereo' | 'maritimo' | '' })}
                >
                  <option value="">Seleccionar…</option>
                  <option value="aereo">Aéreo</option>
                  <option value="maritimo">Marítimo</option>
                </select>
              </Field>

              <Field label="Nombre de referencia">
                <input
                  class={inputCls}
                  placeholder="Nombre del destinatario"
                  value={createForm.referenciaName}
                  onInput={(e) => setCreateForm({ ...createForm, referenciaName: (e.target as HTMLInputElement).value })}
                />
              </Field>

              <div class="grid grid-cols-2 gap-3">
                <Field label="Peso (lb)">
                  <input
                    type="number"
                    step="0.1"
                    class={inputCls}
                    placeholder="0.0"
                    value={createForm.weightLb}
                    onInput={(e) => setCreateForm({ ...createForm, weightLb: (e.target as HTMLInputElement).value })}
                  />
                </Field>

                <Field label="Piezas">
                  <input
                    type="number"
                    min="1"
                    class={inputCls}
                    placeholder="1"
                    value={createForm.pieces}
                    onInput={(e) => setCreateForm({ ...createForm, pieces: (e.target as HTMLInputElement).value })}
                  />
                </Field>
              </div>

              <Field label="Fecha de recepción (opcional)">
                <input
                  type="date"
                  class={inputCls}
                  value={createForm.receivedAt}
                  onChange={(e) => setCreateForm({ ...createForm, receivedAt: (e.target as HTMLInputElement).value })}
                />
              </Field>
            </div>

            <div class="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowCreate(false); setCreateError(null) }}>Cancelar</Button>
              <Button variant="primary" onClick={handleCreatePackage} disabled={createLoading || !createForm.almacenId}>
                {createLoading ? 'Creando…' : 'Crear'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
