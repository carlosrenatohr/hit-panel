import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Upload, Building2, Table2, ScrollText, Save, Plus, Trash2, Pencil, X } from 'lucide-preact'
import type { SessionUser } from '../lib/types'
import { configApi, TIER_LABELS } from '../lib/config'
import type { AgencyInfo, AuditLogEntry, ChargeConcept, CurrencyCode, FreightType, AgencyProfile, PaymentCatalogItem, PaymentCatalogs, RateRow, RateTableInfo } from '../lib/config'
import { insforge } from '../lib/insforge'
import { Button, Card, Field, SectionTitle, Spinner, inputCls } from './ui'

const BRANDING_BUCKET = 'branding'

type Tab = 'info' | 'branding' | 'rates' | 'payments' | 'concepts' | 'audit'

// ─── Config > Información: agency profile + working currency ───────────────────
function InfoTab({ canWrite }: { canWrite: boolean }) {
  const [profile, setProfile] = useState<AgencyProfile | null>(null)
  const [ruc, setRuc] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('USD')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    configApi
      .info()
      .then((p) => {
        setProfile(p)
        setRuc(p.ruc ?? '')
        setAddress(p.address ?? '')
        setPhone(p.phone ?? '')
        setCurrency(p.currency)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la información.'))
      .finally(() => setLoading(false))
  }, [])

  const showNotice = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 4000)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const updated = await configApi.updateInfo({ ruc: ruc.trim() || null, address: address.trim() || null, phone: phone.trim() || null, currency })
      setProfile(updated)
      showNotice('Información guardada.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Cargando información…" />

  return (
    <div class="flex flex-col gap-4">
      {error && <p class="text-sm text-red-600">{error}</p>}
      {notice && <p class="text-sm text-green-700">{notice}</p>}
      <Card class="p-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <Field label="RUC">
            <input class={inputCls} value={ruc} disabled={!canWrite} placeholder="Ej. J0310000123" onChange={(e) => setRuc((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Teléfono">
            <input class={inputCls} value={phone} disabled={!canWrite} placeholder="Ej. 5555-1234" onChange={(e) => setPhone((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Dirección">
            <input class={inputCls} value={address} disabled={!canWrite} placeholder="Calle, ciudad" onChange={(e) => setAddress((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Moneda">
            <div class="flex gap-2">
              {(['USD', 'NIO'] as CurrencyCode[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!canWrite}
                  onClick={() => setCurrency(c)}
                  aria-pressed={currency === c}
                  class={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                    currency === c ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {c === 'USD' ? '$ USD' : 'C$ NIO'}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <p class="mt-3 text-xs text-gray-400">
          RUC, dirección y teléfono (opcionales) aparecen bajo el nombre de la agencia en cada factura. La moneda define el símbolo de los montos: $ para USD, C$ para NIO.
        </p>
        {canWrite && (
          <div class="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving}>
              <Save class="h-4 w-4" aria-hidden="true" />
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Config > Pagos: dynamic methods + banks catalogs ──────────────────────────
function CatalogList({
  items,
  canWrite,
  onToggle,
  onCreate,
  placeholder,
}: {
  items: PaymentCatalogItem[]
  canWrite: boolean
  onToggle: (item: PaymentCatalogItem) => void
  onCreate: (name: string) => void
  placeholder: string
}) {
  const [newName, setNewName] = useState('')
  return (
    <div>
      <ul class="divide-y divide-gray-100">
        {items.map((it) => (
          <li key={it.id} class="flex items-center justify-between py-2">
            <span class={`text-sm ${it.active ? 'font-medium text-gray-800' : 'text-gray-400 line-through'}`}>{it.name}</span>
            {canWrite && (
              <button
                type="button"
                onClick={() => onToggle(it)}
                class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${it.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {it.active ? 'Activo' : 'Inactivo'}
              </button>
            )}
          </li>
        ))}
        {items.length === 0 && <li class="py-2 text-sm text-gray-400">Sin elementos.</li>}
      </ul>
      {canWrite && (
        <div class="mt-3 flex items-end gap-2">
          <Field label="Agregar">
            <input class={inputCls} value={newName} placeholder={placeholder} onChange={(e) => setNewName((e.target as HTMLInputElement).value)} />
          </Field>
          <Button
            variant="ghost"
            disabled={!newName.trim()}
            onClick={() => {
              onCreate(newName.trim())
              setNewName('')
            }}
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
            Agregar
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Config > Conceptos: templates for custom extra invoice charges ─────────────
function ConceptosTab({ canWrite }: { canWrite: boolean }) {
  const [concepts, setConcepts] = useState<ChargeConcept[]>([])
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    configApi
      .chargeConcepts()
      .then(setConcepts)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los conceptos.'))
  }
  useEffect(load, [])

  async function create() {
    if (!newName.trim()) return
    const price = newPrice.trim() === '' ? null : Number(newPrice)
    if (price != null && !(price >= 0)) return setError('El valor sugerido debe ser un número positivo.')
    try {
      await configApi.createChargeConcept(newName.trim(), price)
      setNewName('')
      setNewPrice('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el concepto.')
    }
  }

  async function toggle(it: ChargeConcept) {
    try {
      await configApi.updateChargeConcept(it.id, { active: !it.active })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  if (error && concepts.length === 0) return <p class="text-sm text-red-600">{error}</p>

  return (
    <Card class="p-5">
      <SectionTitle>Conceptos para "Otros" cargos</SectionTitle>
      <p class="mb-3 text-xs text-gray-400">
        Plantillas de cargos extra (ej. Delivery). El valor sugerido solo precarga el monto en la factura: el admin siempre puede ajustarlo. Solo aparecen en la factura si están activos.
      </p>
      {error && <p class="mb-2 text-sm text-red-600">{error}</p>}
      <ul class="divide-y divide-gray-100">
        {concepts.map((c) => (
          <li key={c.id} class="flex items-center justify-between py-2">
            <span class={`text-sm ${c.active ? 'font-medium text-gray-800' : 'text-gray-400 line-through'}`}>
              {c.name}
              {c.suggestedPrice != null && <span class="ml-2 text-xs text-gray-400">sugerido: {c.suggestedPrice.toFixed(2)}</span>}
            </span>
            {canWrite && (
              <button
                type="button"
                onClick={() => toggle(c)}
                class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {c.active ? 'Activo' : 'Inactivo'}
              </button>
            )}
          </li>
        ))}
        {concepts.length === 0 && <li class="py-2 text-sm text-gray-400">Sin conceptos todavía.</li>}
      </ul>
      {canWrite && (
        <div class="mt-3 flex items-end gap-2">
          <Field label="Nombre">
            <input class={inputCls} value={newName} placeholder="Ej. Delivery" onChange={(e) => setNewName((e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="Valor sugerido (opcional)">
            <input type="number" min="0" step="0.01" class={inputCls} value={newPrice} placeholder="Ej. 3.00" onChange={(e) => setNewPrice((e.target as HTMLInputElement).value)} />
          </Field>
          <Button variant="ghost" disabled={!newName.trim()} onClick={create}>
            <Plus class="h-4 w-4" aria-hidden="true" />
            Agregar
          </Button>
        </div>
      )}
    </Card>
  )
}

function PaymentsTab({ canWrite }: { canWrite: boolean }) {
  const [catalogs, setCatalogs] = useState<PaymentCatalogs | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    configApi
      .paymentCatalogs()
      .then(setCatalogs)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los catálogos de pago.'))
  }
  useEffect(load, [])

  if (error) return <p class="text-sm text-red-600">{error}</p>
  if (!catalogs) return <Spinner label="Cargando métodos de pago…" />

  return (
    <div class="grid gap-4 lg:grid-cols-2">
      <Card class="p-5">
        <SectionTitle>Métodos de pago</SectionTitle>
        <CatalogList
          items={catalogs.methods}
          canWrite={canWrite}
          placeholder="Ej. Sinpe móvil"
          onToggle={(it) =>
            configApi.updatePaymentMethod(it.id, { active: !it.active }).then(load).catch((e) => setError(e instanceof Error ? e.message : 'Error'))
          }
          onCreate={(name) => configApi.createPaymentMethod(name).then(load).catch((e) => setError(e instanceof Error ? e.message : 'Error'))}
        />
      </Card>
      <Card class="p-5">
        <SectionTitle>Bancos</SectionTitle>
        <CatalogList
          items={catalogs.banks}
          canWrite={canWrite}
          placeholder="Ej. BAC"
          onToggle={(it) => configApi.updatePaymentBank(it.id, { active: !it.active }).then(load).catch((e) => setError(e instanceof Error ? e.message : 'Error'))}
          onCreate={(name) => configApi.createPaymentBank(name).then(load).catch((e) => setError(e instanceof Error ? e.message : 'Error'))}
        />
      </Card>
    </div>
  )
}

type RowDraft = { tier: string; price: string; cost: string }

/** A brand-new table starts with one empty draft row; the user names the tier
 *  (any name — tiers are dynamic text now) and fills price/cost. */
function toDrafts(rows?: RateRow[]): RowDraft[] {
  const src = rows ?? []
  if (src.length === 0) return [{ tier: 'REGULAR', price: '', cost: '' }]
  return src.map((r) => ({
    tier: r.tier,
    price: r.price === 0 ? '' : String(r.price),
    cost: r.cost === null ? '' : String(r.cost),
  }))
}

/** Only tiers with a name AND a price are saved — empty drafts never become
 *  0-price rows, and duplicate tier names collapse (last wins) so the upsert
 *  never hits the same (table, tier) twice in one request. */
function toRows(drafts: RowDraft[]): RateRow[] {
  const byTier = new Map<string, RateRow>()
  for (const d of drafts) {
    const tier = d.tier.trim()
    if (!tier || d.price === '') continue
    byTier.set(tier, { tier, price: Number(d.price) || 0, cost: d.cost === '' ? null : Number(d.cost) || 0 })
  }
  return [...byTier.values()]
}

export default function Configuracion({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<Tab>('info')
  const canWrite = user.role === 'admin' || user.role === 'billing'

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'info', label: 'Información', icon: Building2 },
    { key: 'branding', label: 'Branding', icon: Building2 },
    { key: 'rates', label: 'Tarifas', icon: Table2 },
    { key: 'payments', label: 'Pagos', icon: ScrollText },
    { key: 'concepts', label: 'Conceptos', icon: Table2 },
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
      {tab === 'info' && <InfoTab canWrite={canWrite} />}
      {tab === 'branding' && <BrandingTab user={user} canWrite={canWrite} />}
      {tab === 'rates' && <RatesTab user={user} canWrite={canWrite} />}
      {tab === 'payments' && <PaymentsTab canWrite={canWrite} />}
      {tab === 'concepts' && <ConceptosTab canWrite={canWrite} />}
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
      // Branding is scoped server-side to the session agency — even admins only
      // see their own. No client-side filter is needed.
      const { agencies: rows } = await configApi.branding()
      setAgencies(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el branding.')
    }
    setLoading(false)
  }, [user.agency])

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
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      setError('Slug de agencia inválido.')
      return
    }
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
        const editable = canWrite && (user.role === 'admin' ? true : a.slug === user.agency)
        return (
          <Card key={a.slug} class="p-4">
            <div class="flex items-center gap-4">
              <div class="flex flex-col items-center gap-1">
                {a.logoUrl ? (
                  <img
                    src={a.logoUrl}
                    alt={`Logo de ${a.name}`}
                    class="h-12 w-12 rounded-md border border-gray-200 object-contain bg-white"
                  />
                ) : (
                  <div class="flex h-12 w-12 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-400">
                    <Building2 class="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <span class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  {a.logoUrl ? 'Logo actual' : 'Sin logo'}
                </span>
              </div>
              <div class="flex-1">
                <div class="mb-1 text-lg font-semibold text-gray-800">{a.name}</div>
                <div class="text-xs text-gray-500">
                  {a.slug} {a.logoUrl ? '· logo personalizado' : '· sin logo personalizado'}
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
  const [tables, setTables] = useState<RateTableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newFreight, setNewFreight] = useState<FreightType>('AIR')
  const [editing, setEditing] = useState<Record<string, RowDraft[]>>({})
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // The Worker resolves the organization from the session (never the payload),
  // so there is no org selector here — each user manages their own agency's rates.
  const agency = user.agency

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rates = await configApi.listRates()
      setTables(rates.tables)
      setEditing({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las tarifas.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [agency, load])

  const showError = (e: unknown) => setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.')
  const showNotice = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 4000)
  }

  function updateDraft(tableId: string, sourceRows: RateRow[], index: number, field: 'tier' | 'price' | 'cost', value: string) {
    setEditing((prev) => {
      const drafts = prev[tableId] ?? toDrafts(sourceRows)
      const next = [...drafts]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, [tableId]: next }
    })
  }

  function addDraftRow(tableId: string) {
    setEditing((prev) => {
      const drafts = prev[tableId] ?? toDrafts(tables.find((t) => t.id === tableId)?.rows)
      return { ...prev, [tableId]: [...drafts, { tier: '', price: '', cost: '' }] }
    })
  }

  function removeDraftRow(tableId: string, index: number) {
    setEditing((prev) => {
      const drafts = prev[tableId] ?? toDrafts(tables.find((t) => t.id === tableId)?.rows)
      return { ...prev, [tableId]: drafts.filter((_, i) => i !== index) }
    })
  }

  async function createTable() {
    if (!newName.trim()) return
    setError(null)
    try {
      const created = await configApi.createRate({ name: newName.trim(), freightType: newFreight })
      setNewName('')
      // The created table ships without rows — seed an empty draft row instead of
      // crashing on undefined (the pre-dynamic-tiers bug).
      setTables((prev) => [...prev, { ...created, rows: created.rows ?? [] }])
      setEditing((prev) => ({ ...prev, [created.id]: toDrafts(created.rows ?? []) }))
      showNotice('Tabla de tarifas creada. Agrega los rangos y guarda.')
    } catch (e) {
      showError(e)
    }
  }

  async function renameTable(id: string) {
    if (!renaming || !renaming.name.trim()) return
    if (!window.confirm(`¿Renombrar "${renaming.name}"? Esta acción se registra en el historial de auditoría.`)) return
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
    const rows = toRows(drafts)
    if (rows.length === 0) {
      setError('Agrega al menos un rango con nombre y precio antes de guardar.')
      return
    }
    if (!window.confirm('¿Guardar los cambios en las tarifas de esta tabla? Esta acción se registra en el historial de auditoría.')) return
    setSaving(id)
    setError(null)
    try {
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

  if (loading && tables.length === 0) return <Spinner label="Cargando tarifas…" />

  return (
    <div class="flex flex-col gap-4">
      {error && <p class="text-sm text-red-600">{error}</p>}
      {notice && <p class="text-sm text-green-700">{notice}</p>}

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
                  <th class="py-2 pr-3">Tarifa</th>
                  <th class="py-2 pr-3">Precio (USD)</th>
                  <th class="py-2">Costo (USD)</th>
                  {canWrite && dirty && <th class="py-2 w-8" aria-label="Quitar fila" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isEditing = canWrite && dirty
                  return (
                    <tr key={`${r.tier}-${i}`} class="border-b border-gray-100">
                      <td class="py-1.5 pr-3 font-medium text-gray-700">
                        {isEditing ? (
                          <input
                            class={inputCls}
                            value={(r as RowDraft).tier}
                            placeholder="Ej. VIP"
                            onChange={(e) => updateDraft(t.id, t.rows, i, 'tier', (e.target as HTMLInputElement).value)}
                          />
                        ) : (
                          <span>{TIER_LABELS[r.tier] ?? r.tier}</span>
                        )}
                      </td>
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
                      {isEditing && (
                        <td class="py-1.5 text-right">
                          <button type="button" aria-label="Quitar tarifa" class="text-gray-300 hover:text-red-500" onClick={() => removeDraftRow(t.id, i)}>
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {canWrite && dirty && (
              <div class="mt-3 flex justify-between">
                <Button variant="ghost" onClick={() => addDraftRow(t.id)}>
                  <Plus class="h-4 w-4" aria-hidden="true" />
                  Agregar tarifa
                </Button>
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
                       <td class="py-2 pr-3 text-gray-600">{r.actorEmail ? r.actorEmail.replace(/^([^@])[^@]*(@.*)$/, '$1***$2') : r.actorId ?? '—'}</td>
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
