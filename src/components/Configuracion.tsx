import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Upload, Building2, Table2, ScrollText, Save, Plus, Trash2, Pencil, X } from 'lucide-preact'
import type { SessionUser } from '../lib/types'
import { configApi, TIER_LABELS } from '../lib/config'
import type { AgencyInfo, AuditLogEntry, FreightType, PriceTier, RateRow, RateTableInfo } from '../lib/config'
import { customerApi } from '../lib/customer'
import type { Customer } from '../lib/customer'
import { insforge } from '../lib/insforge'
import { Button, Card, Field, SectionTitle, Spinner, inputCls } from './ui'

const BRANDING_BUCKET = 'branding'

type Tab = 'branding' | 'rates' | 'audit'

type RowDraft = { tier: PriceTier; price: string; cost: string }

const EMPTY_DRAFTS: RowDraft[] = (
  Object.keys(TIER_LABELS) as PriceTier[]
).map((tier) => ({ tier, price: '', cost: '' }))

function toDrafts(rows: RateRow[]): RowDraft[] {
  if (rows.length === 0) return [...EMPTY_DRAFTS]
  return rows.map((r) => ({
    tier: r.tier,
    price: r.price === 0 ? '' : String(r.price),
    cost: r.cost === null ? '' : String(r.cost),
  }))
}

function toRows(drafts: RowDraft[]): RateRow[] {
  return drafts.map((d) => ({
    tier: d.tier,
    price: Number(d.price) || 0,
    cost: d.cost === '' ? null : Number(d.cost) || 0,
  }))
}

export default function Configuracion({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<Tab>('branding')
  const canWrite = user.role === 'admin' || user.role === 'billing'

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'branding', label: 'Branding', icon: Building2 },
    { key: 'rates', label: 'Tarifas', icon: Table2 },
    { key: 'audit', label: 'Auditoría', icon: ScrollText },
  ]

  return (
    <div class="flex flex-col gap-4">
      <SectionTitle>Configuración</SectionTitle>
      <div class="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={active ? 'page' : undefined}
              class={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon class="h-4 w-4" aria-hidden="true" />
              {t.label}
            </button>
          )
        })}
      </div>
      {tab === 'branding' && <BrandingTab user={user} canWrite={canWrite} />}
      {tab === 'rates' && <RatesTab user={user} canWrite={canWrite} />}
      {tab === 'audit' && <AuditTab user={user} />}
    </div>
  )
}

// ── Branding ──────────────────────────────────────────────────────────────────

function BrandingTab({ user, canWrite }: { user: SessionUser; canWrite: boolean }) {
  const [agencies, setAgencies] = useState<AgencyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { agencies: rows } = await configApi.branding()
      setAgencies(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el branding.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Downscales to ≤512px (WebP ~50KB target) so logos stay light in the sidebar. */
  async function downscaleLogo(file: File): Promise<Blob> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const i = new Image()
      i.onload = () => {
        URL.revokeObjectURL(url)
        resolve(i)
      }
      i.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('La imagen no se pudo leer.'))
      }
      i.src = url
    })
    const max = 512
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Tu navegador no soporta la edición de imágenes.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen optimizada.'))),
        'image/webp',
        0.85,
      )
    })
  }

  async function handleLogo(slug: string, file: File | null) {
    if (!file) return
    setUploading(slug)
    setError(null)
    try {
      const blob = await downscaleLogo(file)
      const { data, error: uploadError } = await insforge.storage.from(BRANDING_BUCKET).upload(`logos/${slug}.webp`, blob)
      if (uploadError) throw uploadError
      if (!data?.url) throw new Error('El logo se subió pero no devolvió URL.')
      await configApi.updateBranding(slug, { logoKey: data.key })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el logo.')
    }
    setUploading(null)
  }

  if (loading) return <Spinner label="Cargando branding…" />
  if (error && agencies.length === 0)
    return (
      <Card>
        <p class="text-sm text-red-600">{error}</p>
      </Card>
    )

  return (
    <div class="flex flex-col gap-3">
      {error && <p class="text-sm text-red-600">{error}</p>}
      {agencies.map((a) => {
        const editable = canWrite && (user.role === 'admin' || user.role === 'billing' ? true : a.slug === user.agency)
        return (
          <Card key={a.slug}>
            <div class="flex items-center gap-4">
              {a.logoUrl ? (
                <img src={a.logoUrl} alt={a.name} class="h-12 w-12 rounded-lg border border-gray-200 object-contain bg-white" />
              ) : (
                <div class="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
                  <Building2 class="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <div class="flex-1">
                <div class="text-sm font-semibold text-gray-800">{a.name}</div>
                <div class="text-xs text-gray-500">
                  {a.slug} {a.logoUrl ? '· logo actualizado' : '· sin logo personalizado'}
                </div>
              </div>
              {editable && (
                <label
                  class={`flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark ${
                    uploading === a.slug ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <Upload class="h-4 w-4" aria-hidden="true" />
                  {uploading === a.slug ? 'Subiendo…' : 'Subir logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="hidden"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      const f = (e.target as HTMLInputElement).files?.[0] ?? null
                      if (f) void handleLogo(a.slug, f)
                    }}
                  />
                </label>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── Rates ─────────────────────────────────────────────────────────────────────

const FREIGHT_LABELS: Record<FreightType, string> = { AIR: 'Aéreo', MAR: 'Marítimo' }

function RatesTab({ user, canWrite }: { user: SessionUser; canWrite: boolean }) {
  const [orgs, setOrgs] = useState<AgencyInfo[]>([])
  const [org, setOrg] = useState<string>(user.agency)
  const [tables, setTables] = useState<RateTableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<Customer[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newFreight, setNewFreight] = useState<FreightType>('AIR')
  const [editing, setEditing] = useState<Record<string, RowDraft[]>>({})
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [assignClient, setAssignClient] = useState('')
  const [assignTable, setAssignTable] = useState('')
  const [overrideGuia, setOverrideGuia] = useState('')
  const [overrideTable, setOverrideTable] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const multiOrg = canWrite && (user.role === 'admin' || user.role === 'billing')

  const load = useCallback(async (selectedOrg?: string) => {
    setLoading(true)
    setError(null)
    try {
      const [branding, rates] = await Promise.all([configApi.branding(), configApi.listRates(selectedOrg)])
      setOrgs(branding.agencies)
      setTables(rates.tables)
      setEditing({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las tarifas.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load(multiOrg ? org : undefined)
  }, [org, load, multiOrg])

  useEffect(() => {
    void customerApi
      .list({ pageSize: 500 })
      .then(({ rows }) => setClients(rows))
      .catch(() => setClients([]))
  }, [])

  const showError = (e: unknown) => setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.')
  const showNotice = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 4000)
  }

  function updateDraft(tableId: string, sourceRows: RateRow[], index: number, field: 'price' | 'cost', value: string) {
    setEditing((prev) => {
      const drafts = prev[tableId] ?? toDrafts(sourceRows)
      const next = [...drafts]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, [tableId]: next }
    })
  }

  async function createTable() {
    if (!newName.trim()) return
    setError(null)
    try {
      const input: { name: string; freightType: FreightType; organizationId?: string } = { name: newName.trim(), freightType: newFreight }
      if (multiOrg) input.organizationId = org
      const created = await configApi.createRate(input)
      setNewName('')
      setTables((prev) => [created, ...prev])
      setEditing((prev) => ({ ...prev, [created.id]: toDrafts(created.rows) }))
      showNotice('Tabla de tarifas creada.')
    } catch (e) {
      showError(e)
    }
  }

  async function renameTable(id: string) {
    if (!renaming || !renaming.name.trim()) return
    setError(null)
    try {
      await configApi.renameRate(id, renaming.name.trim())
      setRenaming(null)
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, name: renaming.name.trim() } : t)))
      showNotice('Tabla renombrada.')
    } catch (e) {
      showError(e)
    }
  }

  async function removeTable(id: string) {
    if (!window.confirm('¿Eliminar esta tabla de tarifas? Los clientes que la usen quedan sin tarifa asignada.')) return
    setError(null)
    try {
      await configApi.deleteRate(id)
      setTables((prev) => prev.filter((t) => t.id !== id))
      showNotice('Tabla eliminada.')
    } catch (e) {
      showError(e)
    }
  }

  async function saveRows(id: string) {
    const drafts = editing[id]
    if (!drafts) return
    setSaving(id)
    setError(null)
    try {
      const rows = toRows(drafts)
      await configApi.replaceRows(id, rows)
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, rows } : t)))
      setEditing((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      showNotice('Tarifas guardadas.')
    } catch (e) {
      showError(e)
    }
    setSaving(null)
  }

  async function assignDefault() {
    if (!assignClient) return
    setError(null)
    try {
      await configApi.assignClientDefault(assignClient, assignTable || null)
      showNotice(assignTable ? 'Tarifa por defecto asignada al cliente.' : 'Tarifa por defecto removida.')
      setAssignClient('')
      setAssignTable('')
    } catch (e) {
      showError(e)
    }
  }

  async function applyOverride() {
    const guia = overrideGuia.trim()
    if (!guia) return
    setError(null)
    try {
      await configApi.overridePackage(guia, overrideTable || null)
      showNotice(overrideTable ? `Tarifa especial aplicada a ${guia}.` : `Tarifa especial removida de ${guia}.`)
      setOverrideGuia('')
      setOverrideTable('')
    } catch (e) {
      showError(e)
    }
  }

  if (loading && tables.length === 0) return <Spinner label="Cargando tarifas…" />

  return (
    <div class="flex flex-col gap-4">
      {error && <p class="text-sm text-red-600">{error}</p>}
      {notice && <p class="text-sm text-green-700">{notice}</p>}

      {multiOrg && (
        <Card>
          <div class="flex items-center gap-2">
            <Field label="Organización">
              <select class={inputCls} value={org} onChange={(e) => setOrg((e.target as HTMLSelectElement).value)}>
                {orgs.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>
      )}

      {canWrite && (
        <Card>
          <div class="flex flex-wrap items-end gap-3">
            <Field label="Nueva tabla">
              <input class={inputCls} value={newName} placeholder="Ej. Tarifas 2026" onChange={(e) => setNewName((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Tipo">
              <select class={inputCls} value={newFreight} onChange={(e) => setNewFreight((e.target as HTMLSelectElement).value as FreightType)}>
                <option value="AIR">Aéreo</option>
                <option value="MAR">Marítimo</option>
              </select>
            </Field>
            <Button onClick={createTable} disabled={!newName.trim()}>
              <Plus class="h-4 w-4" aria-hidden="true" />
              Crear
            </Button>
          </div>
        </Card>
      )}

      {tables.map((t) => {
        const drafts = editing[t.id]
        const dirty = drafts !== undefined
        const rows = dirty ? drafts : t.rows
        return (
          <Card key={t.id}>
            <div class="mb-3 flex items-center justify-between gap-2">
              {renaming?.id === t.id ? (
                <div class="flex items-center gap-2">
                  <input
                    class={inputCls}
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: t.id, name: (e.target as HTMLInputElement).value })}
                  />
                  <Button onClick={() => renameTable(t.id)} disabled={!renaming.name.trim()}>
                    Guardar
                  </Button>
                  <Button variant="ghost" onClick={() => setRenaming(null)}>
                    <X class="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <div class="text-sm font-semibold text-gray-800">
                  {t.name} <span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">{FREIGHT_LABELS[t.freightType]}</span>
                </div>
              )}
              <div class="flex items-center gap-2">
                {canWrite && !renaming && (
                  <>
                    <IconButtonSmall label="Renombrar" onClick={() => setRenaming({ id: t.id, name: t.name })}>
                      <Pencil class="h-4 w-4" />
                    </IconButtonSmall>
                    <IconButtonSmall label="Eliminar" onClick={() => removeTable(t.id)} danger>
                      <Trash2 class="h-4 w-4" />
                    </IconButtonSmall>
                  </>
                )}
              </div>
            </div>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th class="py-2 pr-3">Rango (lb)</th>
                  <th class="py-2 pr-3">Precio (USD)</th>
                  <th class="py-2">Costo (USD)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isEditing = canWrite && dirty
                  return (
                    <tr key={r.tier} class="border-b border-gray-100">
                      <td class="py-1.5 pr-3 font-medium text-gray-700">{TIER_LABELS[r.tier]}</td>
                      <td class="py-1.5 pr-3">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            class={inputCls}
                            value={(r as RowDraft).price}
                            onChange={(e) => updateDraft(t.id, t.rows, i, 'price', (e.target as HTMLInputElement).value)}
                          />
                        ) : canWrite ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            class={inputCls}
                            value={(r as RateRow).price === 0 ? '' : String((r as RateRow).price)}
                            onChange={(e) => updateDraft(t.id, t.rows, i, 'price', (e.target as HTMLInputElement).value)}
                          />
                        ) : (
                          <span class="text-gray-700">${Number((r as RateRow).price).toFixed(2)}</span>
                        )}
                      </td>
                      <td class="py-1.5">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            class={inputCls}
                            value={(r as RowDraft).cost}
                            placeholder="—"
                            onChange={(e) => updateDraft(t.id, t.rows, i, 'cost', (e.target as HTMLInputElement).value)}
                          />
                        ) : canWrite ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            class={inputCls}
                            value={(r as RateRow).cost ?? ''}
                            placeholder="—"
                            onChange={(e) => updateDraft(t.id, t.rows, i, 'cost', (e.target as HTMLInputElement).value)}
                          />
                        ) : (
                          <span class="text-gray-500">{(r as RateRow).cost === null ? '—' : `$${Number((r as RateRow).cost).toFixed(2)}`}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {canWrite && dirty && (
              <div class="mt-3 flex justify-end">
                <Button onClick={() => saveRows(t.id)} disabled={saving === t.id}>
                  <Save class="h-4 w-4" aria-hidden="true" />
                  {saving === t.id ? 'Guardando…' : 'Guardar tarifas'}
                </Button>
              </div>
            )}
          </Card>
        )
      })}

      {tables.length === 0 && (
        <Card>
          <p class="text-sm text-gray-500">No hay tablas de tarifas para esta organización.</p>
        </Card>
      )}

      {canWrite && (
        <Card>
          <SectionTitle>Tarifa por defecto del cliente</SectionTitle>
          <div class="flex flex-wrap items-end gap-3">
            <Field label="Cliente">
              <select class={inputCls} value={assignClient} onChange={(e) => setAssignClient((e.target as HTMLSelectElement).value)}>
                <option value="">Seleccionar cliente…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tabla">
              <select class={inputCls} value={assignTable} onChange={(e) => setAssignTable((e.target as HTMLSelectElement).value)}>
                <option value="">(sin tarifa)</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {FREIGHT_LABELS[t.freightType]}
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={assignDefault} disabled={!assignClient}>
              Aplicar
            </Button>
          </div>
          <p class="mt-2 text-xs text-gray-500">La tarifa por defecto se aplica a los envíos de ese cliente cuando no tiene una especial.</p>
        </Card>
      )}

      {canWrite && (
        <Card>
          <SectionTitle>Tarifa especial por envío</SectionTitle>
          <div class="flex flex-wrap items-end gap-3">
            <Field label="Guía / tracking">
              <input class={inputCls} value={overrideGuia} placeholder="Ej. 123-4567890" onChange={(e) => setOverrideGuia((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Tabla">
              <select class={inputCls} value={overrideTable} onChange={(e) => setOverrideTable((e.target as HTMLSelectElement).value)}>
                <option value="">(quitar especial)</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {FREIGHT_LABELS[t.freightType]}
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={applyOverride} disabled={!overrideGuia.trim()}>
              Aplicar
            </Button>
          </div>
          <p class="mt-2 text-xs text-gray-500">Sobrescribe la tarifa del paquete individual; el default del cliente queda intacto.</p>
        </Card>
      )}
    </div>
  )
}

function IconButtonSmall({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ComponentChildren
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      class={`flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        danger ? 'text-red-600 hover:border-red-300 hover:bg-red-50' : 'text-gray-500 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

// ── Audit ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

function AuditTab({ user }: { user: SessionUser }) {
  const [rows, setRows] = useState<AuditLogEntry[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await configApi.audit({ action: action || undefined, entityType: entityType || undefined, page: p, pageSize: PAGE_SIZE })
      setRows(res.rows)
      setCount(res.count)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la auditoría.')
    }
    setLoading(false)
  }, [action, entityType])

  useEffect(() => {
    void load(page)
  }, [page, load])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const uniqueActions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows])

  return (
    <div class="flex flex-col gap-3">
      <Card>
        <div class="flex flex-wrap items-end gap-3">
          <Field label="Acción">
            <select class={inputCls} value={action} onChange={(e) => { setAction((e.target as HTMLSelectElement).value); setPage(1) }}>
              <option value="">Todas</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Entidad">
            <select class={inputCls} value={entityType} onChange={(e) => { setEntityType((e.target as HTMLSelectElement).value); setPage(1) }}>
              <option value="">Todas</option>
              <option value="package">Paquete</option>
              <option value="rate_table">Tabla de tarifas</option>
              <option value="billing_client">Cliente</option>
              <option value="agency">Agencia</option>
            </select>
          </Field>
        </div>
      </Card>
      {error && <p class="text-sm text-red-600">{error}</p>}
      {loading ? (
        <Spinner label="Cargando auditoría…" />
      ) : (
        <Card>
          {rows.length === 0 ? (
            <p class="text-sm text-gray-500">Sin registros para los filtros elegidos.</p>
          ) : (
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th class="py-2 pr-3">Fecha</th>
                    <th class="py-2 pr-3">Acción</th>
                    <th class="py-2 pr-3">Actor</th>
                    <th class="py-2 pr-3">Entidad</th>
                    <th class="py-2 pr-3">Org</th>
                    <th class="py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} class="border-b border-gray-100 align-top">
                      <td class="py-2 pr-3 whitespace-nowrap text-gray-500">
                        {new Date(r.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td class="py-2 pr-3 font-medium text-gray-800">{r.action}</td>
                      <td class="py-2 pr-3 text-gray-600">{r.actorEmail ?? r.actorId ?? '—'}</td>
                      <td class="py-2 pr-3 text-gray-600">
                        {r.entityType ?? '—'}
                        {r.entityId ? <span class="block text-xs text-gray-400">{r.entityId}</span> : null}
                      </td>
                      <td class="py-2 pr-3 text-gray-600">{r.organizationId}</td>
                      <td class="py-2 text-xs text-gray-500">{r.metadata ? JSON.stringify(r.metadata) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div class="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span>
                Página {page} de {totalPages} ({count} registros)
              </span>
              <div class="flex gap-2">
                <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Anterior
                </Button>
                <Button variant="ghost" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
