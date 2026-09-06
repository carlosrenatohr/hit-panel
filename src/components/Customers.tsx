import { Pencil, Plus, Save, Users, X } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { configApi } from '../lib/config'
import { customerApi, type Customer, type CustomerInput } from '../lib/customer'
import type { RateTableInfo } from '../lib/config'
import type { Role } from '../lib/types'
import { Button, Card, Field, inputCls, SectionTitle, Spinner } from './ui'
import ClientSearch from './ui/ClientSearch'

const PAGE_SIZE = 25

export default function Customers({ role }: { role: Role }) {
  const canWrite = role === 'admin' || role === 'billing'
  const [rows, setRows] = useState<Customer[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<(CustomerInput & { id?: string }) | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
      .list({ search: search || undefined, toReview: reviewOnly || undefined, page, pageSize: PAGE_SIZE })
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
  }, [page, revision, reviewOnly, search])

  const selected = rows.find((row) => row.id === selectedId) ?? null
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  function openCreate() {
    setSelectedId(null)
    setForm({ name: '', casillero: '', toReview: false, email: '', phone: '', address: '', defaultRateTableId: '' })
  }

  function openEdit(customer: Customer) {
    setSelectedId(customer.id)
    setForm({ id: customer.id, name: customer.name, casillero: customer.casillero ?? '', toReview: customer.toReview, email: customer.email ?? '', phone: customer.phone ?? '', address: customer.address ?? '', defaultRateTableId: customer.defaultRateId ?? '' })
  }

  async function save() {
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      const payload = { name: form.name, casillero: form.casillero || null, toReview: form.toReview, email: form.email?.trim() || null, phone: form.phone?.trim() || null, address: form.address?.trim() || null, defaultRateTableId: form.defaultRateTableId || null }
      if (form.id) await customerApi.update(form.id, payload)
      else await customerApi.create(payload)
      setForm(null)
      setRevision((value) => value + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="flex items-center gap-2 text-lg font-bold text-secondary"><Users class="h-5 w-5" /> Clientes</h1>
        {canWrite && <Button onClick={openCreate}><Plus class="h-4 w-4" /> Nuevo cliente</Button>}
      </div>

      {error && <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {form && (
        <Card accent class="p-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-semibold text-secondary">{form.id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <button type="button" class="text-gray-400 hover:text-gray-700" onClick={() => setForm(null)} aria-label="Cerrar formulario"><X class="h-4 w-4" /></button>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <Field label="Nombre">
              <input class={inputCls} value={form.name} onInput={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} autoFocus />
            </Field>
            <Field label="Casillero">
              <input class={inputCls} value={form.casillero ?? ''} onInput={(e) => setForm({ ...form, casillero: (e.target as HTMLInputElement).value })} />
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
            <label class="flex items-end gap-2 pb-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.toReview ?? false} onChange={(e) => setForm({ ...form, toReview: (e.target as HTMLInputElement).checked })} />
              Requiere revisión
            </label>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? <Spinner /> : <><Save class="h-4 w-4" /> Guardar</>}</Button>
          </div>
        </Card>
      )}

      <Card class="p-3">
        <div class="flex flex-wrap gap-2">
          <ClientSearch
            value={search}
            onSelect={(c) => { setSearch(c.name); setPage(1) }}
            onClear={() => { setSearch(''); setPage(1) }}
            placeholder="Buscar cliente…"
            class="min-w-64 flex-1"
          />
          <label class="flex items-center gap-2 px-2 text-sm text-gray-600">
            <input type="checkbox" checked={reviewOnly} onChange={(e) => { setReviewOnly((e.target as HTMLInputElement).checked); setPage(1) }} />
            Solo revisión
          </label>
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
              <thead><tr class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400"><th class="px-4 py-2">Nombre</th><th class="px-4 py-2">Casillero</th><th class="px-4 py-2">Estado</th><th class="px-4 py-2 text-right">Acciones</th></tr></thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id} class={`border-b border-gray-50 ${selectedId === customer.id ? 'bg-gray-50' : ''}`}>
                    <td class="cursor-pointer px-4 py-2 font-medium text-secondary" onClick={() => setSelectedId(customer.id)}>{customer.name}</td>
                    <td class="px-4 py-2 text-gray-500">{customer.casillero || '—'}</td>
                    <td class="px-4 py-2">{customer.toReview ? <span class="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">Revisión</span> : <span class="text-xs text-gray-400">Normal</span>}</td>
                    <td class="px-4 py-2 text-right">{canWrite && <button class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100" onClick={() => openEdit(customer)}><Pencil class="h-3.5 w-3.5" /> Editar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && <div class="flex justify-center gap-2 border-t border-gray-100 p-3"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div>}
      </Card>

      {selected && !form && (
        <Card class="p-4">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="font-semibold text-secondary">{selected.name}</h2>
              <p class="mt-1 text-sm text-gray-500">Normalizado: {selected.nameNormalized}</p>
              <p class="text-sm text-gray-500">Casillero: {selected.casillero || '—'}</p>
              {selected.email && <p class="text-sm text-gray-500">Email: {selected.email}</p>}
              {selected.phone && <p class="text-sm text-gray-500">Teléfono: {selected.phone}</p>}
              {selected.address && <p class="text-sm text-gray-500">Dirección: {selected.address}</p>}
              {selected.defaultRateId && <p class="text-sm text-gray-500">Tarifa asignada ✓</p>}
            </div>
            {canWrite && <Button variant="ghost" onClick={() => openEdit(selected)}><Pencil class="h-4 w-4" /> Editar</Button>}
          </div>
        </Card>
      )}
    </div>
  )
}
