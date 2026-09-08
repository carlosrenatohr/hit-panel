import { Ban, Flag, Pencil, Plus, Save, UserCheck, Users, X } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { configApi } from '../lib/config'
import { customerApi, type Customer, type CustomerInput } from '../lib/customer'
import type { RateTableInfo } from '../lib/config'
import type { Role } from '../lib/types'
import { Button, Card, Field, inputCls, SectionTitle, Spinner } from './ui'
import ClientSearch from './ui/ClientSearch'
import { MultiSelect } from './ui/MultiSelect'

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Desactivado' },
  { value: 'review', label: 'Revisión' },
]

export default function Customers({ role }: { role: Role }) {
  const canWrite = role === 'admin' || role === 'billing'
  const [rows, setRows] = useState<Customer[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [form, setForm] = useState<(CustomerInput & { id?: string }) | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rateTables, setRateTables] = useState<RateTableInfo[]>([])

  useEffect(() => {
    configApi.listRates().then(({ tables }) => setRateTables(tables)).catch(() => setRateTables([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    customerApi
      .list({ search: search || undefined, statuses: statuses.length ? statuses : undefined, page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return
        setRows(result.rows)
        setCount(result.count)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'No se pudieron cargar los clientes.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [page, revision, statuses, search])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  function openCreate() {
    setError(null)
    setForm({ name: '', casillero: '', companyName: '', taxId: '', toReview: false, email: '', phone: '', address: '', defaultRateTableId: '' })
  }

  function openEdit(customer: Customer) {
    setError(null)
    setForm({ id: customer.id, name: customer.name, casillero: customer.casillero ?? '', companyName: customer.companyName ?? '', taxId: customer.taxId ?? '', toReview: customer.toReview, email: customer.email ?? '', phone: customer.phone ?? '', address: customer.address ?? '', defaultRateTableId: customer.defaultRateId ?? '' })
  }

  async function save() {
    if (!form) return
    const id = form.id
    const isEdit = !!id
    if (!window.confirm(isEdit ? `¿Guardar los cambios del cliente "${form.name.trim()}"?` : `¿Crear el cliente "${form.name.trim()}"?`)) return
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
        defaultRateTableId: form.defaultRateTableId || null,
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

  async function toggleActive(customer: Customer) {
    const deactivating = customer.active !== false
    const confirmMsg = deactivating
      ? `¿Deshabilitar a "${customer.name}"? Sus paquetes quedarán fuera del dashboard hasta que lo reactives.`
      : `¿Reactivar a "${customer.name}"? Sus paquetes volverán a aparecer en el dashboard.`
    if (!window.confirm(confirmMsg)) return
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

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="flex items-center gap-2 text-lg font-bold text-secondary"><Users class="h-5 w-5" /> Clientes</h1>
        {canWrite && <Button onClick={openCreate}><Plus class="h-4 w-4" /> Nuevo cliente</Button>}
      </div>

      {error && <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* ── Create / edit modal ── */}
      {form && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-lg font-semibold text-secondary">{form.id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button type="button" class="text-gray-400 hover:text-gray-700" onClick={() => setForm(null)} aria-label="Cerrar formulario"><X class="h-4 w-4" /></button>
            </div>
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
                <select class={inputCls} value={form.defaultRateTableId ?? ''} onChange={(e) => setForm({ ...form, defaultRateTableId: (e.target as HTMLSelectElement).value })}>
                  <option value="">(sin tarifa asignada)</option>
                  {rateTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.freightType === 'AIR' ? 'Aéreo' : 'Marítimo'}
                    </option>
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
              <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? <Spinner /> : <><Save class="h-4 w-4" /> Guardar</>}</Button>
            </div>
          </div>
        </div>
      )}

      <Card class="p-3">
        <div class="flex flex-wrap gap-2">
          <ClientSearch
            value={search}
            includeInactive
            onSelect={(c) => { setSearch(c.name); setPage(1) }}
            onClear={() => { setSearch(''); setPage(1) }}
            placeholder="Buscar cliente…"
            class="min-w-64 flex-1"
          />
          <div class="min-w-40">
            <MultiSelect
              options={STATUS_OPTIONS}
              selected={statuses}
              onChange={(v) => { setStatuses(v); setPage(1) }}
              placeholder="Estado"
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle class="justify-between"><span>{count} clientes</span><span class="text-xs font-normal text-gray-400">Página {page} de {totalPages}</span></SectionTitle>
        {loading ? (
          <div class="p-6"><Spinner label="Cargando clientes…" /></div>
        ) : rows.length === 0 ? (
          <div class="p-6 text-sm text-gray-400">No hay clientes para estos filtros.</div>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th class="px-4 py-2">Nombre</th>
                  <th class="px-4 py-2">Casillero</th>
                  <th class="px-4 py-2">Estado</th>
                  <th class="px-4 py-2 text-center">Paquetes</th>
                  <th class="px-4 py-2 text-right">Acciones</th>
                </tr>
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
                        </span>
                      </td>
                      <td class="px-4 py-2 text-gray-500">{customer.casillero || '—'}</td>
                      <td class="px-4 py-2">
                        {inactive ? (
                          <span class="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Desactivado</span>
                        ) : (
                          <span class="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Activo</span>
                        )}
                      </td>
                      <td class="px-4 py-2 text-center">
                        <span class="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{customer.packageCount ?? 0}</span>
                      </td>
                      <td class="px-4 py-2">
                        {canWrite && (
                          <div class="flex items-center justify-end gap-2">
                            <button class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100" onClick={() => openEdit(customer)}><Pencil class="h-3.5 w-3.5" /> Editar</button>
                            <button
                              class={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-gray-100 ${inactive ? 'text-green-700' : 'text-red-700'}`}
                              disabled={actionId === customer.id}
                              onClick={() => toggleActive(customer)}
                            >
                              {inactive ? <><UserCheck class="h-3.5 w-3.5" /> Reactivar</> : <><Ban class="h-3.5 w-3.5" /> Deshabilitar</>}
                            </button>
                          </div>
                        )}
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
    </div>
  )
}