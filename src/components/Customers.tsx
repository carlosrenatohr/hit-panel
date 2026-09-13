import { Archive, Ban, Flag, History, Layers, Pencil, Plus, Save, UserCheck, Users } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { configApi, type RateCardInfo } from '../lib/config'
import { customerApi, type Customer, type CustomerAggregateStats, type CustomerDeletePreview, type CustomerEvent, type CustomerInput } from '../lib/customer'
import type { Role } from '../lib/types'
import { navigate } from '../lib/router'
import { Button, Card, ConfirmDialog, Field, inputCls, Modal, SectionTitle, Spinner, Tooltip } from './ui'
import ClientSearch from './ui/ClientSearch'
import { DateRangePicker } from './DateRangePicker'
import CustomerCards from './CustomerCards'
import { CUSTOMER_COLUMN_DEFS, CustomerColumnPicker, useCustomerColumnPrefs } from './CustomerColumns'
import CustomerTimeline from './CustomerTimeline'

const PAGE_SIZE = 25

const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  ISSUED: 'Emitida',
  PARTIAL: 'Parcial',
  PAID: 'Pagada',
  VOID: 'Anulada',
}

type CustomersTab = 'clientes' | 'bitacora'

interface StatusTab {
  key: string
  label: string
  icon: typeof Layers
  filter: string[]
  activeCls: string
}

const STATUS_TABS: StatusTab[] = [
  { key: 'all', label: 'Todos', icon: Layers, filter: [], activeCls: 'border-primary bg-primary/10 text-primary' },
  { key: 'active', label: 'Activos', icon: UserCheck, filter: ['active'], activeCls: 'border-green-500 bg-green-50 text-green-700' },
  { key: 'inactive', label: 'Desactivados', icon: Ban, filter: ['inactive'], activeCls: 'border-red-400 bg-red-50 text-red-600' },
  { key: 'review', label: 'Revisión', icon: Flag, filter: ['review'], activeCls: 'border-amber-400 bg-amber-50 text-amber-700' },
]

export default function Customers({ role }: { role: Role }) {
  const canWrite = role === 'admin' || role === 'billing'
  const colPrefs = useCustomerColumnPrefs()
  const visibleCols = colPrefs.columns
    .filter((c) => c.visible)
    .map((c) => CUSTOMER_COLUMN_DEFS.find((d) => d.key === c.key))
    .filter((d): d is (typeof CUSTOMER_COLUMN_DEFS)[number] => !!d)

  const weightColsVisible = visibleCols.filter((c) => c.key === 'maritimo' || c.key === 'aereo')
  const showWeightGroup = weightColsVisible.length >= 2
  const showSingleMar = weightColsVisible.some((c) => c.key === 'maritimo') && !showWeightGroup
  const showSingleAer = weightColsVisible.some((c) => c.key === 'aereo') && !showWeightGroup

  const [tab, setTab] = useState<CustomersTab>('clientes')
  const [rows, setRows] = useState<Customer[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [stats, setStats] = useState<CustomerAggregateStats | null>(null)
  const [form, setForm] = useState<(CustomerInput & { id?: string }) | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rateCards, setRateCards] = useState<RateCardInfo[]>([])
  const [confirmAction, setConfirmAction] = useState<{ kind: 'save' } | { kind: 'toggle'; customer: Customer } | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null)
  const [archivePreview, setArchivePreview] = useState<CustomerDeletePreview | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [timeline, setTimeline] = useState<{ customer: Customer; events: CustomerEvent[]; loading: boolean } | null>(null)
  const [auditRows, setAuditRows] = useState<CustomerEvent[]>([])
  const [auditCount, setAuditCount] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [auditLoading, setAuditLoading] = useState(false)

  useEffect(() => {
    configApi.listRateCards().then(({ cards }) => setRateCards(cards)).catch(() => setRateCards([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    customerApi
      .list({ search: search || undefined, statuses: statuses.length ? statuses : undefined, from: from || undefined, to: to || undefined, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return
        setRows(result.rows)
        setCount(result.count)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [page, revision, statuses, search, from, to])

  useEffect(() => {
    let cancelled = false
    customerApi
      .stats(from || undefined, to || undefined)
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setStats(null))
    return () => { cancelled = true }
  }, [from, to, revision])

  useEffect(() => {
    let cancelled = false
    setAuditLoading(true)
    configApi
      .audit({ entityType: 'billing_client', page: auditPage, pageSize: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setAuditRows(res.rows as CustomerEvent[])
        setAuditCount(res.count)
      })
      .catch(() => !cancelled && setAuditRows([]))
      .finally(() => !cancelled && setAuditLoading(false))
    return () => { cancelled = true }
  }, [auditPage, revision])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const auditTotalPages = Math.max(1, Math.ceil(auditCount / PAGE_SIZE))

  function openCreate() {
    setError(null)
    setForm({ name: '', casillero: '', companyName: '', taxId: '', toReview: false, email: '', phone: '', address: '', defaultRateCardId: '' })
  }

  function openEdit(customer: Customer) {
    setError(null)
    setForm({ id: customer.id, name: customer.name, casillero: customer.casillero ?? '', companyName: customer.companyName ?? '', taxId: customer.taxId ?? '', toReview: customer.toReview, email: customer.email ?? '', phone: customer.phone ?? '', address: customer.address ?? '', defaultRateCardId: customer.defaultRateCardId ?? '' })
  }

  function requestSave() {
    if (!form) return
    setConfirmAction({ kind: 'save' })
  }

  async function save() {
    if (!form) return
    const id = form.id
    const isEdit = !!id
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        casillero: form.casillero || null,
        toReview: form.toReview,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        companyName: form.companyName?.trim() || null,
        taxId: form.taxId?.trim() || null,
        defaultRateCardId: form.defaultRateCardId || null,
      }
      if (isEdit && id) await customerApi.update(id, payload)
      else await customerApi.create(payload)
      setForm(null)
      setRevision((value) => value + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  function requestToggle(customer: Customer) {
    setConfirmAction({ kind: 'toggle', customer })
  }

  async function toggleActive(customer: Customer) {
    const deactivating = customer.active !== false
    setActionId(customer.id)
    setError(null)
    try {
      await customerApi.update(customer.id, { active: deactivating ? false : true })
      setRevision((value) => value + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado del cliente.')
    } finally {
      setActionId(null)
    }
  }

  async function requestArchive(customer: Customer) {
    setError(null)
    try {
      const preview = await customerApi.deletePreview(customer.id)
      setArchivePreview(preview)
      setArchiveTarget(customer)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el impacto del archivado.')
    }
  }

  async function doArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    setError(null)
    try {
      await customerApi.delete(archiveTarget.id)
      setArchiveTarget(null)
      setArchivePreview(null)
      setRevision((value) => value + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo archivar el cliente.')
    } finally {
      setArchiving(false)
    }
  }

  async function openTimeline(customer: Customer) {
    setError(null)
    setTimeline({ customer, events: [], loading: true })
    try {
      const { rows } = await customerApi.events(customer.id)
      setTimeline({ customer, events: rows, loading: false })
    } catch (e) {
      setTimeline({ customer, events: [], loading: false })
      setError(e instanceof Error ? e.message : 'No se pudo cargar la bitácora.')
    }
  }

  function viewClientPackages(name: string) {
    navigate({ view: 'shipments', cliente: name })
  }

  const activeTabKey = STATUS_TABS.find((t) => JSON.stringify(t.filter) === JSON.stringify(statuses))?.key ?? 'all'

  return (
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="flex items-center gap-2 text-lg font-bold text-secondary"><Users class="h-5 w-5" /> Clientes</h1>
        <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
          <button type="button" onClick={() => setTab('clientes')} class={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'clientes' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            Clientes
          </button>
          <button type="button" onClick={() => setTab('bitacora')} class={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'bitacora' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <History class="h-3.5 w-3.5" aria-hidden="true" /> Bitácora
          </button>
        </div>
        {canWrite && <Button onClick={openCreate}><Plus class="h-4 w-4" /> Nuevo cliente</Button>}
      </div>

      {error && <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.id ? 'Editar cliente' : 'Nuevo cliente'}>
        {form && (
          <>
            <div class="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre">
                <input class={inputCls} value={form.name} onInput={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} autoFocus />
              </Field>
              <Field label="Casillero">
                <input class={inputCls} value={form.casillero ?? ''} onInput={(e) => setForm({ ...form, casillero: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Compañía / subagencia">
                <input class={inputCls} value={form.companyName ?? ''} onInput={(e) => setForm({ ...form, companyName: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Cédula / RUC">
                <input class={inputCls} value={form.taxId ?? ''} onInput={(e) => setForm({ ...form, taxId: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Email">
                <input type="email" class={inputCls} value={form.email ?? ''} onInput={(e) => setForm({ ...form, email: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Teléfono">
                <input class={inputCls} value={form.phone ?? ''} onInput={(e) => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Dirección">
                <input class={inputCls} value={form.address ?? ''} onInput={(e) => setForm({ ...form, address: (e.target as HTMLInputElement).value })} />
              </Field>
              <Field label="Tarifa por defecto">
                <select class={inputCls} value={form.defaultRateCardId ?? ''} onChange={(e) => setForm({ ...form, defaultRateCardId: (e.target as HTMLSelectElement).value })}>
                  <option value="">(sin tarifa asignada)</option>
                  {rateCards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <label class="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.toReview ?? false} onChange={(e) => setForm({ ...form, toReview: (e.target as HTMLInputElement).checked })} />
                Requiere revisión
              </label>
            </div>
            <div class="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
              <Button onClick={requestSave} disabled={saving || !form.name.trim()}>{saving ? <Spinner /> : <><Save class="h-4 w-4" /> Guardar</>}</Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          const action = confirmAction
          setConfirmAction(null)
          if (action?.kind === 'save') void save()
          else if (action?.kind === 'toggle') void toggleActive(action.customer)
        }}
        title={confirmAction?.kind === 'toggle' ? (confirmAction.customer.active === false ? 'Reactivar cliente' : 'Deshabilitar cliente') : 'Guardar cliente'}
        message={
          confirmAction?.kind === 'toggle'
            ? confirmAction.customer.active === false
              ? `¿Reactivar a "${confirmAction.customer.name}"? Sus paquetes volverán a aparecer en el dashboard.`
              : `¿Deshabilitar a "${confirmAction.customer.name}"? Sus paquetes quedarán fuera del dashboard hasta que lo reactives.`
            : `¿Guardar el cliente "${form?.name.trim()}"?`
        }
        confirmLabel={confirmAction?.kind === 'toggle' ? 'Confirmar' : 'Guardar'}
        loading={saving}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => { setArchiveTarget(null); setArchivePreview(null) }}
        onConfirm={doArchive}
        title="Archivar cliente"
        message={
          <div class="space-y-3">
            <p class="text-sm font-semibold text-amber-700">
              Vas a archivar a «{archiveTarget?.name}». Se oculta de la operación (sin borrarlo) y sus paquetes/facturas dejan de mostrarse. Podés deshacerlo reactivando el cliente.
            </p>
            {archivePreview ? (
              <div class="space-y-3 text-sm text-gray-600">
                <div>
                  {archivePreview.packageCount > 0 ? (
                    <>
                      <p class="font-medium text-gray-800">
                        {archivePreview.packageCount} paquete{archivePreview.packageCount === 1 ? '' : 's'} relacionado{archivePreview.packageCount === 1 ? '' : 's'}:
                      </p>
                      <ul class="ml-4 list-disc">
                        {archivePreview.packages.map((p, i) => (
                          <li key={i} class="font-mono text-xs text-gray-500">
                            {p.guia ?? '—'}{p.tracking ? ` · ${p.tracking}` : ''}
                          </li>
                        ))}
                        {archivePreview.packageCount > archivePreview.packages.length && (
                          <li class="text-xs text-gray-400">+ {archivePreview.packageCount - archivePreview.packages.length} más</li>
                        )}
                      </ul>
                    </>
                  ) : (
                    <p>Sin paquetes relacionados.</p>
                  )}
                </div>
                <div>
                  {archivePreview.invoiceCount > 0 ? (
                    <>
                      <p class="font-medium text-gray-800">
                        {archivePreview.invoiceCount} factura{archivePreview.invoiceCount === 1 ? '' : 's'} relacionada{archivePreview.invoiceCount === 1 ? '' : 's'}:
                      </p>
                      <ul class="ml-4 list-disc">
                        {archivePreview.invoices.map((inv, i) => (
                          <li key={i} class="font-mono text-xs text-gray-500">
                            {inv.fiscalYear}-{inv.invoiceNumber} · {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                          </li>
                        ))}
                        {archivePreview.invoiceCount > archivePreview.invoices.length && (
                          <li class="text-xs text-gray-400">+ {archivePreview.invoiceCount - archivePreview.invoices.length} más</li>
                        )}
                      </ul>
                    </>
                  ) : (
                    <p>Sin facturas relacionadas.</p>
                  )}
                </div>
              </div>
            ) : (
              <p class="text-sm text-gray-400">Cargando impacto…</p>
            )}
          </div>
        }
        confirmLabel="Archivar"
        loading={archiving}
      />

      <Modal open={timeline !== null} onClose={() => setTimeline(null)} title={timeline ? `Bitácora · ${timeline.customer.name}` : ''}>
        {timeline?.loading ? (
          <div class="p-6"><Spinner label="Cargando bitácora…" /></div>
        ) : (
          <div class="max-h-[60vh] overflow-y-auto scroll-thin">
            <CustomerTimeline events={timeline?.events ?? []} />
          </div>
        )}
      </Modal>

      {tab === 'bitacora' ? (
        <Card>
          <SectionTitle class="justify-between"><span>Bitácora de clientes</span><span class="text-xs font-normal text-gray-400">Página {auditPage} de {auditTotalPages}</span></SectionTitle>
          {auditLoading ? (
            <div class="p-6"><Spinner label="Cargando bitácora…" /></div>
          ) : auditRows.length === 0 ? (
            <div class="p-6 text-sm text-gray-400">Sin eventos registrados.</div>
          ) : (
            <div class="max-h-[70vh] overflow-y-auto px-3">
              <CustomerTimeline events={auditRows} />
            </div>
          )}
          {auditTotalPages > 1 && <div class="flex justify-center gap-2 border-t border-gray-100 p-3"><Button variant="ghost" disabled={auditPage <= 1} onClick={() => setAuditPage((value) => value - 1)}>Anterior</Button><Button variant="ghost" disabled={auditPage >= auditTotalPages} onClick={() => setAuditPage((value) => value + 1)}>Siguiente</Button></div>}
        </Card>
      ) : (
        <>
          <Card class="p-3">
            <div class="flex flex-wrap items-center gap-2">
              <ClientSearch
                value={search}
                includeInactive
                onSelect={(c) => { setSearch(c.name); setPage(1) }}
                onClear={() => { setSearch(''); setPage(1) }}
                placeholder="Buscar cliente…"
                class="w-56 sm:w-64"
              />
              <div class="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
                {STATUS_TABS.map((t) => {
                  const Icon = t.icon
                  const active = activeTabKey === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => { setStatuses(t.filter); setPage(1) }}
                      aria-pressed={active}
                      class={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                        active ? t.activeCls : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                      }`}
                    >
                      <Icon class="h-3.5 w-3.5" aria-hidden="true" />
                      {t.label}
                    </button>
                  )
                })}
              </div>
              <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f ?? ''); setTo(t ?? ''); setPage(1) }} />
              <CustomerColumnPicker prefs={colPrefs} />
            </div>
          </Card>

          {stats && <CustomerCards stats={stats} onViewClient={viewClientPackages} />}

          <Card>
            <SectionTitle class="justify-between"><span>{count} clientes</span><span class="text-xs font-normal text-gray-400">Página {page} de {totalPages}</span></SectionTitle>
            {loading ? (
              <div class="p-6"><Spinner label="Cargando clientes…" /></div>
            ) : rows.length === 0 ? (
              <div class="p-6 text-sm text-gray-400">No hay clientes para estos filtros.</div>
            ) : (
              <div class="overflow-x-auto">
                <table class="min-w-[900px] w-full text-left text-sm">
                  <thead>
                    <tr class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                      <th class="px-4 py-2" rowSpan={2}>Nombre</th>
                      {visibleCols.map((col) => (
                        <th key={col.key} class="px-4 py-2" rowSpan={2}>{col.label}</th>
                      ))}
                      {showWeightGroup && (
                        <th class="px-4 py-2 text-center" colSpan={2} title="Peso total en libras (total de paquetes)">Volumen total en libras (total paquetes)</th>
                      )}
                      {showSingleMar && (
                        <th class="px-4 py-2" rowSpan={2} title="Peso total en libras (total de paquetes)">Marítimo</th>
                      )}
                      {showSingleAer && (
                        <th class="px-4 py-2" rowSpan={2} title="Peso total en libras (total de paquetes)">Aéreo</th>
                      )}
                      <th class="px-4 py-2 text-center" rowSpan={2}>Paquetes totales</th>
                      <th class="px-4 py-2 text-right" rowSpan={2}>Acciones</th>
                    </tr>
                    {showWeightGroup && (
                      <tr class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                        {visibleCols.some((c) => c.key === 'maritimo') && <th class="px-4 py-2" title="Peso total en libras (total de paquetes)">Marítimo</th>}
                        {visibleCols.some((c) => c.key === 'aereo') && <th class="px-4 py-2" title="Peso total en libras (total de paquetes)">Aéreo</th>}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {rows.map((customer) => {
                      const inactive = customer.active === false
                      return (
                        <tr key={customer.id} class="border-b border-gray-50">
                          <td class="px-4 py-2 font-medium text-secondary">
                            <span class="inline-flex items-center gap-1.5">
                              {customer.name}
                              {customer.toReview && (
                                <span title="Requiere revisión" class="inline-flex text-yellow-500">
                                  <Flag class="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                              )}
                              {inactive && (
                                <span title="Deshabilitado" class="inline-flex text-red-500">
                                  <Ban class="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                              )}
                            </span>
                          </td>
                          {visibleCols.map((col) => (
                            <td key={col.key} class="px-4 py-2">{col.render(customer)}</td>
                          ))}
                          <td class="px-4 py-2 text-center">
                            <span class="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{customer.packageCount ?? 0}</span>
                          </td>
                          <td class="px-4 py-2">
                            <div class="flex items-center justify-end gap-1">
                              <Tooltip text="Ver bitácora de este cliente">
                                <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Ver bitácora" onClick={() => openTimeline(customer)}>
                                  <History class="h-4 w-4" />
                                </button>
                              </Tooltip>
                              {canWrite && (
                                <>
                                  <Tooltip text="Editar datos del cliente">
                                    <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Editar cliente" onClick={() => openEdit(customer)}>
                                      <Pencil class="h-4 w-4" />
                                    </button>
                                  </Tooltip>
                                  <Tooltip text={inactive ? 'Reactivar cliente: sus paquetes vuelven a aparecer' : 'Deshabilitar cliente: oculta sus paquetes del dashboard'}>
                                    <button
                                      type="button"
                                      class={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 ${inactive ? 'text-green-700' : 'text-gray-400 hover:text-gray-700'}`}
                                      aria-label={inactive ? 'Reactivar cliente' : 'Deshabilitar cliente'}
                                      disabled={actionId === customer.id}
                                      onClick={() => requestToggle(customer)}
                                    >
                                      {inactive ? <UserCheck class="h-4 w-4" /> : <Ban class="h-4 w-4" />}
                                    </button>
                                  </Tooltip>
                                  <Tooltip text="Archivar cliente: lo oculta sin borrarlo (paquetes y facturas dejan de mostrarse)">
                                    <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Archivar cliente" onClick={() => requestArchive(customer)}>
                                      <Archive class="h-4 w-4" />
                                    </button>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && <div class="flex justify-center gap-2 border-t border-gray-100 p-3"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div>}
          </Card>
        </>
      )}
    </div>
  )
}
