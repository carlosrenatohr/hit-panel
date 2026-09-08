import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Upload, Building2, Table2, ScrollText, Save, Plus, Trash2, Pencil, X } from 'lucide-preact'
import type { SessionUser } from '../lib/types'
import { configApi } from '../lib/config'
import { customerApi } from '../lib/customer'
import type { Customer } from '../lib/customer'
import type { AgencyInfo, AuditLogEntry, ChargeConcept, CurrencyCode, FreightType, AgencyProfile, PaymentCatalogItem, PaymentCatalogs, RateCardEntryInput, RateCardInfo, PriceModel } from '../lib/config'
import { insforge } from '../lib/insforge'
import { fmtMoney } from '../lib/format'
import { Button, Card, ConfirmDialog, Field, Modal, SectionTitle, Spinner, inputCls } from './ui'

const BRANDING_BUCKET = 'branding'

type Tab = 'info' | 'rates' | 'payments' | 'audit'

// ─── Config > Información: agency profile + working currency + exchange rate ──
function InfoTab({ user, canWrite }: { user: SessionUser; canWrite: boolean }) {
  const [profile, setProfile] = useState<AgencyProfile | null>(null)
  const [name, setName] = useState('')
  const [ruc, setRuc] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('USD')
  const [rate, setRate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    configApi
      .info()
      .then((p) => {
        setProfile(p)
        setName(p.name)
        setRuc(p.ruc ?? '')
        setAddress(p.address ?? '')
        setPhone(p.phone ?? '')
        setCurrency(p.currency)
        setRate(p.exchangeRateNioPerUsd != null ? String(p.exchangeRateNioPerUsd) : '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la información.'))
      .finally(() => setLoading(false))
  }, [])

  const showNotice = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 4000)
  }

  const nameChanged = name.trim() !== (profile?.name ?? '')

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

  async function save() {
    const parsed = rate.trim() === '' ? null : Number(rate)
    if (parsed != null && !(parsed > 0)) {
      setError('La tasa de cambio debe ser un número mayor que cero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: import('../lib/config').AgencyInfoPatch = {
        ruc: ruc.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        currency,
        exchangeRateNioPerUsd: parsed,
      }
      if (nameChanged) payload.name = name.trim()
      const updated = await configApi.updateInfo(payload)
      setProfile(updated)
      setName(updated.name)
      showNotice('Información guardada.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(/once per month/i.test(msg) ? 'El nombre de la agencia solo se puede cambiar una vez cada mes.' : msg || 'No se pudo guardar.')
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
        <div class="grid gap-6 lg:grid-cols-2">
          {/* Left: agency logo, then the display name below it */}
          <div class="space-y-4">
            <BrandingTab user={user} canWrite={canWrite} />
            <Field label="Nombre de la agencia">
              <input class={inputCls} value={name} disabled={!canWrite} placeholder="Ej. HIT Cargo" onChange={(e) => setName((e.target as HTMLInputElement).value)} />
            </Field>
            {nameChanged && canWrite && (
              <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                El nombre solo se puede cambiar una vez cada mes.
                {profile?.nameLastUpdated && <> Último cambio: {fmtDate(profile.nameLastUpdated)}.</>}
              </p>
            )}
          </div>
          {/* Right: contact fields, then currency + exchange rate, then helper text */}
          <div class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-3">
              <Field label="Dirección">
                <input class={`${inputCls} w-full min-w-0`} value={address} disabled={!canWrite} placeholder="Calle, ciudad" onChange={(e) => setAddress((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="Número de teléfono">
                <input class={`${inputCls} w-full min-w-0`} value={phone} disabled={!canWrite} placeholder="Ej. 5555-1234" onChange={(e) => setPhone((e.target as HTMLInputElement).value)} />
              </Field>
              <Field label="RUC">
                <input class={`${inputCls} w-full min-w-0`} value={ruc} disabled={!canWrite} placeholder="Ej. J0310000123" onChange={(e) => setRuc((e.target as HTMLInputElement).value)} />
              </Field>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
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
              <Field label="Tasa de cambio (C$ por US$)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  class={inputCls}
                  value={rate}
                  disabled={!canWrite}
                  placeholder="37.00"
                  onChange={(e) => setRate((e.target as HTMLInputElement).value)}
                />
              </Field>
            </div>
            <p class="text-xs text-gray-400">
              RUC, dirección y teléfono (opcionales) aparecen bajo el nombre de la agencia en cada factura. La moneda define el símbolo de los montos: $ para USD, C$ para NIO. La tasa de cambio se captura manualmente (fuente: Manual) y se usará para conversiones futuras.
            </p>
            {canWrite && (
              <div class="flex justify-end">
                <Button onClick={save} disabled={saving}>
                  <Save class="h-4 w-4" aria-hidden="true" />
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            )}
          </div>
        </div>
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
    <div class="flex flex-col gap-4">
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
      <ConceptosTab canWrite={canWrite} />
    </div>
  )
}

type RowDraft = { tier: string; price: string; cost: string; priceModel: string }

export default function Configuracion({ user }: { user: SessionUser }) {
  const [tab, setTab] = useState<Tab>('info')
  const canWrite = user.role === 'admin' || user.role === 'billing'

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'info', label: 'Información', icon: Building2 },
    { key: 'rates', label: 'Tarifas', icon: Table2 },
    { key: 'payments', label: 'Pagos', icon: ScrollText },
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
      {tab === 'info' && <InfoTab user={user} canWrite={canWrite} />}
      {tab === 'rates' && <RatesTab user={user} canWrite={canWrite} />}
      {tab === 'payments' && <PaymentsTab canWrite={canWrite} />}
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

const PRICE_MODEL_LABELS: Record<PriceModel, string> = {
  weight: 'Por peso (US$/lb)',
  volume: 'Por volumen (US$/ft³)',
  fixed: 'Monto fijo por paquete',
}

/** One editable card = the two AIR/MAR entries of the current published version. */
type CardDraft = {
  air: { name: string; price: string; cost: string }
  mar: { name: string; price: string; cost: string }
}

function toCardDraft(card: RateCardInfo): CardDraft {
  const entry = (s: 'AIR' | 'MAR') => card.currentVersion.entries.find((e) => e.serviceType === s)
  const a = entry('AIR')
  const m = entry('MAR')
  return {
    air: { name: a?.name ?? 'Regular', price: a ? String(a.price) : '', cost: a ? String(a.cost) : '' },
    mar: { name: m?.name ?? 'Regular', price: m ? String(m.price) : '', cost: m ? String(m.cost) : '' },
  }
}

/** Both entries must be complete (name + price + cost) — a card is a single AIR/MAR pair. */
function draftToEntries(d: CardDraft): RateCardEntryInput[] {
  const out: RateCardEntryInput[] = []
  for (const key of ['air', 'mar'] as const) {
    const f = d[key]
    if (f.price === '') continue
    out.push({
      serviceType: key === 'air' ? 'AIR' : 'MAR',
      name: f.name.trim() || 'Regular',
      price: Number(f.price) || 0,
      cost: f.cost === '' ? 0 : Number(f.cost) || 0,
    })
  }
  return out
}

function RatesTab({ user, canWrite }: { user: SessionUser; canWrite: boolean }) {
  const [cards, setCards] = useState<RateCardInfo[]>([])
  const [currency, setCurrency] = useState<CurrencyCode>('USD')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newModel, setNewModel] = useState<PriceModel>('weight')
  const [modelNotice, setModelNotice] = useState<string | null>(null)
  /** cardId → draft; presence means that card is in edit mode. */
  const [editing, setEditing] = useState<Record<string, CardDraft>>({})
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'save' | 'rename'; id: string; name: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // The Worker resolves the organization from the session (never the payload).
  const agency = user.agency

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rates, info] = await Promise.all([configApi.listRateCards(), configApi.info().catch(() => null)])
      setCards(rates.cards)
      setEditing({})
      if (info) setCurrency(info.currency)
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

  function startEdit(card: RateCardInfo) {
    setEditing((prev) => ({ ...prev, [card.id]: toCardDraft(card) }))
  }

  function cancelEdit(card: RateCardInfo) {
    setEditing((prev) => {
      const next = { ...prev }
      delete next[card.id]
      return next
    })
  }

  function updateField(cardId: string, key: 'air' | 'mar', field: 'name' | 'price' | 'cost', value: string) {
    setEditing((prev) => {
      const draft = prev[cardId] ?? toCardDraft(cards.find((c) => c.id === cardId)!)
      const next = { ...prev, [cardId]: { ...draft, [key]: { ...draft[key], [field]: value } } }
      return next
    })
  }

  async function createCard() {
    if (!newName.trim() || newModel !== 'weight') return
    setError(null)
    try {
      const created = await configApi.createRateCard({
        name: newName.trim(),
        priceModel: 'weight',
        entries: [
          { serviceType: 'AIR', name: 'Regular', price: 0, cost: 0 },
          { serviceType: 'MAR', name: 'Regular', price: 0, cost: 0 },
        ],
      })
      setCards((prev) => [...prev, created])
      setCreateOpen(false)
      setNewName('')
      setNewModel('weight')
      setModelNotice(null)
      setEditing((prev) => ({ ...prev, [created.id]: toCardDraft(created) }))
      showNotice('Tabla creada. Completa Aéreo y Marítimo y guarda.')
    } catch (e) {
      showError(e)
    }
  }

  function requestRename(id: string, name: string) {
    setRenaming({ id, name })
  }

  function doRename() {
    if (!renaming?.name.trim()) return
    setConfirm({ kind: 'rename', id: renaming.id, name: renaming.name.trim() })
  }

  function requestDelete(id: string, name: string) {
    setConfirm({ kind: 'delete', id, name })
  }

  function requestSave(id: string) {
    const draft = editing[id]
    if (!draft) return
    const entries = draftToEntries(draft)
    if (entries.length !== 2 || entries.some((e) => !e.name.trim())) {
      setError('Completa nombre, precio y costo de Aéreo y Marítimo antes de guardar.')
      return
    }
    setConfirm({ kind: 'save', id, name: cards.find((c) => c.id === id)?.name ?? '' })
  }

  async function runConfirm() {
    const c = confirm
    if (!c) return
    setError(null)
    try {
      if (c.kind === 'delete') {
        await configApi.deleteRateCard(c.id)
        setCards((prev) => prev.filter((x) => x.id !== c.id))
        setEditing((prev) => {
          const next = { ...prev }
          delete next[c.id]
          return next
        })
        showNotice('Tabla eliminada.')
      } else if (c.kind === 'save') {
        setSaving(c.id)
        const updated = await configApi.replaceCardEntries(c.id, draftToEntries(editing[c.id]))
        setCards((prev) => prev.map((x) => (x.id === c.id ? updated : x)))
        setEditing((prev) => {
          const next = { ...prev }
          delete next[c.id]
          return next
        })
        showNotice('Tarifas guardadas.')
      } else {
        const updated = await configApi.renameRateCard(c.id, c.name)
        setCards((prev) => prev.map((x) => (x.id === c.id ? updated : x)))
        setRenaming(null)
        showNotice('Tabla renombrada.')
      }
    } catch (e) {
      showError(e)
    } finally {
      setSaving(null)
      setConfirm(null)
    }
  }

  if (loading && cards.length === 0) return <Spinner label="Cargando tarifas…" />

  return (
    <div class="flex flex-col gap-4">
      {error && <p class="text-sm text-red-600">{error}</p>}
      {notice && <p class="text-sm text-green-700">{notice}</p>}

      {canWrite && (
        <Card class="p-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold text-gray-800">Tablas de tarifas</div>
              <p class="text-xs text-gray-500">
                Cada tabla es un plan con dos precios: Aéreo y Marítimo. Para otro par de precios, crea otra tabla.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus class="h-4 w-4" aria-hidden="true" />
              Nueva tabla
            </Button>
          </div>
        </Card>
      )}

      {cards.map((card) => {
        const isEditing = canWrite && editing[card.id] !== undefined
        const draft = editing[card.id] ?? toCardDraft(card)
        return (
          <Card key={card.id}>
            <div class="mb-3 flex items-center justify-between gap-2">
              {renaming && renaming.id === card.id ? (
                <div class="flex items-center gap-2">
                  <input class={inputCls} value={renaming.name} onChange={(e) => setRenaming({ id: card.id, name: (e.target as HTMLInputElement).value })} />
                  <Button onClick={doRename} disabled={!renaming.name.trim()}>
                    Guardar
                  </Button>
                  <Button variant="ghost" onClick={() => setRenaming(null)}>
                    <X class="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-gray-800">{card.name}</span>
                  <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">{PRICE_MODEL_LABELS[card.currentVersion.priceModel]}</span>
                </div>
              )}
              <div class="flex items-center gap-2">
                {canWrite && !renaming && (
                  <>
                    <IconButtonSmall label="Renombrar" onClick={() => requestRename(card.id, card.name)}>
                      <Pencil class="h-4 w-4" />
                    </IconButtonSmall>
                    <IconButtonSmall label="Eliminar" onClick={() => requestDelete(card.id, card.name)} danger>
                      <Trash2 class="h-4 w-4" />
                    </IconButtonSmall>
                  </>
                )}
              </div>
            </div>
            <div class="grid gap-4 lg:grid-cols-2">
              {(['air', 'mar'] as const).map((key) => {
                const entry = draft[key]
                const label = key === 'air' ? 'Aéreo' : 'Marítimo'
                return (
                  <div key={key} class="rounded-lg border border-gray-100 p-3">
                    <div class="mb-2 flex items-center justify-between">
                      <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">{label}</span>
                      {canWrite && !isEditing && (
                        <Button variant="ghost" onClick={() => startEdit(card)}>
                          <Pencil class="h-3.5 w-3.5" aria-hidden="true" />
                          Editar
                        </Button>
                      )}
                    </div>
                    <div class="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div class="text-xs text-gray-400">Nombre</div>
                        {isEditing ? (
                          <input class={`${inputCls} w-full min-w-0`} value={entry.name} onChange={(e) => updateField(card.id, key, 'name', (e.target as HTMLInputElement).value)} />
                        ) : (
                          <div class="py-1.5 font-medium text-gray-700">{entry.name}</div>
                        )}
                      </div>
                      <div>
                        <div class="text-xs text-gray-400">Precio ({currency})</div>
                        {isEditing ? (
                          <input type="number" min="0" step="0.01" class={`${inputCls} w-full min-w-0`} value={entry.price} onChange={(e) => updateField(card.id, key, 'price', (e.target as HTMLInputElement).value)} />
                        ) : (
                          <div class="py-1.5 text-gray-700">{fmtMoney(Number(entry.price), currency)}</div>
                        )}
                      </div>
                      <div>
                        <div class="text-xs text-gray-400">Costo ({currency})</div>
                        {isEditing ? (
                          <input type="number" min="0" step="0.01" class={`${inputCls} w-full min-w-0`} value={entry.cost} onChange={(e) => updateField(card.id, key, 'cost', (e.target as HTMLInputElement).value)} />
                        ) : (
                          <div class="py-1.5 text-gray-500">{fmtMoney(Number(entry.cost), currency)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {isEditing && (
              <div class="mt-2 flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => cancelEdit(card)}>
                  Cancelar
                </Button>
                <Button onClick={() => requestSave(card.id)} disabled={saving === card.id}>
                  <Save class="h-4 w-4" aria-hidden="true" />
                  {saving === card.id ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            )}
          </Card>
        )
      })}

      {cards.length === 0 && (
        <Card>
          <p class="text-sm text-gray-500">No hay tablas de tarifas para esta organización.</p>
        </Card>
      )}

      {canWrite && (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva tabla de tarifas" size="sm">
          <div class="flex flex-col gap-4">
            <Field label="Nombre">
              <input class={inputCls} value={newName} placeholder="Ej. Estándar" autoFocus onChange={(e) => setNewName((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Modelo de cobro">
              <select
                class={inputCls}
                value={newModel}
                onChange={(e) => {
                  const m = (e.target as HTMLSelectElement).value as PriceModel
                  setNewModel(m)
                  setModelNotice(m === 'weight' ? null : 'En construcción — por ahora solo se soporta cobro por peso (US$/lb).')
                }}
              >
                <option value="weight">{PRICE_MODEL_LABELS.weight}</option>
                <option value="volume">{PRICE_MODEL_LABELS.volume}</option>
                <option value="fixed">{PRICE_MODEL_LABELS.fixed}</option>
              </select>
            </Field>
            {modelNotice && <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{modelNotice}</p>}
            {newModel === 'weight' && (
              <p class="text-xs text-gray-500">Se creará con Aéreo y Marítimo vacíos; completalos al editar y guarda.</p>
            )}
            <div class="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={createCard} disabled={!newName.trim() || newModel !== 'weight'}>
                <Plus class="h-4 w-4" aria-hidden="true" />
                Crear
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        title={confirm?.kind === 'delete' ? 'Eliminar tabla' : confirm?.kind === 'save' ? 'Guardar tarifas' : 'Renombrar tabla'}
        message={
          confirm?.kind === 'delete'
            ? `¿Eliminar "${confirm.name}"? Esta acción se registra en el historial de auditoría.`
            : confirm?.kind === 'save'
              ? `¿Guardar los cambios en "${confirm.name}"? Esta acción se registra en el historial de auditoría.`
              : `¿Renombrar la tabla a "${confirm?.name}"? Esta acción se registra en el historial de auditoría.`
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Eliminar' : 'Confirmar'}
        loading={saving === confirm?.id}
      />
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
      <Card class="p-4">
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
