import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { Ban, Upload, Building2, Table2, ScrollText, Save, Plus, Trash2, Pencil, UserCheck, X } from 'lucide-preact'
import type { SessionUser } from '../lib/types'
import { configApi } from '../lib/config'
import { customerApi } from '../lib/customer'
import type { Customer } from '../lib/customer'
import type { AgencyInfo, AuditLogEntry, ChargeConcept, CurrencyCode, FreightType, AgencyProfile, PaymentCatalogs, RateCardEntryInput, RateCardInfo, PriceModel } from '../lib/config'
import { insforge } from '../lib/insforge'
import { fmtMoney } from '../lib/format'
import { Button, AlertDialog, Card, ConfirmDialog, Field, Modal, SectionTitle, Spinner, Toast, Tooltip, inputCls } from './ui'

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
            <Field label="Dirección">
              <textarea
                rows={2}
                class={`${inputCls} w-full min-w-0 resize-y`}
                value={address}
                disabled={!canWrite}
                placeholder="Calle, ciudad"
                onChange={(e) => setAddress((e.target as HTMLTextAreaElement).value)}
              />
            </Field>
            <div class="grid gap-3 sm:grid-cols-2">
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

// ─── Config > Pagos: methods + banks + concepts (CRUD with shared Modal) ─────
type CatalogItem = { id: string; name: string; active: boolean; suggestedPrice?: number | null }

function CatalogTable({
  title,
  description,
  label,
  items,
  canWrite,
  withSuggestedPrice,
  onCreate,
  onUpdate,
  onToggle,
  onDelete,
  onError,
}: {
  title: string
  description: string
  label: string
  items: CatalogItem[]
  canWrite: boolean
  withSuggestedPrice?: boolean
  onCreate: (name: string, suggestedPrice: number | null) => Promise<void>
  onUpdate: (id: string, patch: { name?: string; suggestedPrice?: number | null }) => Promise<void>
  onToggle: (item: CatalogItem) => Promise<void>
  onDelete: (item: CatalogItem) => Promise<void>
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState<{ id?: string; name: string; suggestedPrice: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!form) return
    const name = form.name.trim()
    if (!name) return
    const suggestedPrice = withSuggestedPrice ? (form.suggestedPrice.trim() === '' ? null : Number(form.suggestedPrice)) : undefined
    if (suggestedPrice != null && !(suggestedPrice >= 0)) {
      onError('El valor sugerido debe ser un número positivo.')
      return
    }
    setBusy(true)
    try {
      if (form.id) await onUpdate(form.id, withSuggestedPrice ? { name, suggestedPrice } : { name })
      else await onCreate(name, suggestedPrice ?? null)
      setForm(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(item: CatalogItem) {
    try {
      await onToggle(item)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.')
    }
  }

  async function remove() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await onDelete(deleteTarget)
      setDeleteTarget(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo eliminar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card class="overflow-hidden">
      <SectionTitle class="justify-between">
        <span>{title}</span>
        {canWrite && (
          <Button onClick={() => setForm({ name: '', suggestedPrice: '' })}>
            <Plus class="h-4 w-4" aria-hidden="true" />
            Nuevo {label}
          </Button>
        )}
      </SectionTitle>
      <p class="px-5 pt-3 text-xs text-gray-400">{description}</p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th class="px-5 py-2">Nombre</th>
              <th class="px-5 py-2">Estado</th>
              <th class="px-5 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} class="border-b border-gray-50">
                <td class={`px-5 py-2 ${it.active ? 'font-medium text-gray-800' : 'text-gray-400 line-through'}`}>
                  {it.name}
                  {withSuggestedPrice && it.suggestedPrice != null && <span class="ml-2 text-xs text-gray-400">sugerido: {it.suggestedPrice.toFixed(2)}</span>}
                </td>
                <td class="px-5 py-2">
                  <span class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${it.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {it.active ? 'Activo' : 'Desactivado'}
                  </span>
                </td>
                <td class="px-5 py-2">
                  {canWrite && (
                    <div class="flex items-center justify-end gap-1">
                      <IconButtonSmall label={`Editar ${label}`} onClick={() => setForm({ id: it.id, name: it.name, suggestedPrice: it.suggestedPrice != null ? String(it.suggestedPrice) : '' })}>
                        <Pencil class="h-4 w-4" />
                      </IconButtonSmall>
                      <IconButtonSmall label={it.active ? `Desactivar ${label}` : `Activar ${label}`} onClick={() => toggle(it)}>
                        {it.active ? <Ban class="h-4 w-4" /> : <UserCheck class="h-4 w-4" />}
                      </IconButtonSmall>
                      <IconButtonSmall label={`Eliminar ${label}`} onClick={() => setDeleteTarget(it)} danger>
                        <Trash2 class="h-4 w-4" />
                      </IconButtonSmall>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colspan={3} class="px-5 py-4 text-sm text-gray-400">
                  Sin elementos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.id ? `Editar ${label}` : `Nuevo ${label}`} size="sm">
        {form && (
          <div class="flex flex-col gap-4">
            <Field label="Nombre">
              <input class={inputCls} value={form.name} placeholder={`Ej. ${label}`} autoFocus onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} />
            </Field>
            {withSuggestedPrice && (
              <Field label="Valor sugerido (opcional)">
                <input type="number" min="0" step="0.01" class={inputCls} value={form.suggestedPrice} placeholder="Ej. 3.00" onChange={(e) => setForm({ ...form, suggestedPrice: (e.target as HTMLInputElement).value })} />
              </Field>
            )}
            <div class="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForm(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={busy || !form.name.trim()}>
                <Save class="h-4 w-4" aria-hidden="true" />
                {busy ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title={`Eliminar ${label}`}
        message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? Esta acción no tiene retorno.`}
        confirmLabel="Eliminar"
        loading={busy}
      />
    </Card>
  )
}

function PaymentsTab({ canWrite }: { canWrite: boolean }) {
  const [catalogs, setCatalogs] = useState<PaymentCatalogs | null>(null)
  const [concepts, setConcepts] = useState<ChargeConcept[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    configApi
      .paymentCatalogs()
      .then(setCatalogs)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los catálogos de pago.'))
    configApi.chargeConcepts().then(setConcepts).catch(() => {})
  }
  useEffect(load, [])

  if (error) return <p class="text-sm text-red-600">{error}</p>
  if (!catalogs) return <Spinner label="Cargando métodos de pago…" />

  const fail = (msg: string) => setError(msg)

  return (
    <div class="flex flex-col gap-4">
      <div class="grid gap-4 lg:grid-cols-2">
        <CatalogTable
          title="Métodos de pago"
          description="Formas de pago que se ofrecen al registrar un pago. Solo las activas se ofrecen."
          label="método de pago"
          items={catalogs.methods}
          canWrite={canWrite}
          onCreate={(name) => configApi.createPaymentMethod(name).then(load)}
          onUpdate={(id, patch) => configApi.updatePaymentMethod(id, patch).then(load)}
          onToggle={(it) => configApi.updatePaymentMethod(it.id, { active: !it.active }).then(load)}
          onDelete={(it) => configApi.deletePaymentMethod(it.id).then(load)}
          onError={fail}
        />
        <CatalogTable
          title="Bancos"
          description="Bancos disponibles para pagos. Solo los activos se ofrecen."
          label="banco"
          items={catalogs.banks}
          canWrite={canWrite}
          onCreate={(name) => configApi.createPaymentBank(name).then(load)}
          onUpdate={(id, patch) => configApi.updatePaymentBank(id, patch).then(load)}
          onToggle={(it) => configApi.updatePaymentBank(it.id, { active: !it.active }).then(load)}
          onDelete={(it) => configApi.deletePaymentBank(it.id).then(load)}
          onError={fail}
        />
      </div>
      <CatalogTable
        title="Conceptos para 'Otros' cargos"
        description="Plantillas de cargos extra (ej. Delivery). El valor sugerido solo precarga el monto en la factura: el admin siempre puede ajustarlo. Solo aparecen en la factura si están activos."
        label="concepto"
        items={concepts}
        canWrite={canWrite}
        withSuggestedPrice
        onCreate={(name, suggestedPrice) => configApi.createChargeConcept(name, suggestedPrice).then(load)}
        onUpdate={(id, patch) => configApi.updateChargeConcept(id, patch).then(load)}
        onToggle={(it) => configApi.updateChargeConcept(it.id, { active: !it.active }).then(load)}
        onDelete={(it) => configApi.deleteChargeConcept(it.id).then(load)}
        onError={fail}
      />
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
    // Auditoría tab hidden while we design a richer, more useful view for
    // packages/clients (the AuditTab component and route stay wired).
    // { key: 'audit', label: 'Auditoría', icon: ScrollText },
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
      // The key must stay `logos/<slug>.webp`: InsForge dedups an existing key to
      // `logos/<slug> (2).webp` (spaces/parens), which the Worker's object-key
      // regex rejects. Delete the current object so the upload reuses the clean key.
      // A missing object (404) is fine — the key may be stale — only real errors abort.
      const key = `logos/${slug}.webp`
      await removeLogoObject(key)
      const { data, error: uploadError } = await insforge.storage.from(BRANDING_BUCKET).upload(key, blob)
      if (uploadError) throw uploadError
      if (!data?.url) throw new Error('El logo se subió pero no devolvió URL.')
      await configApi.updateBranding(slug, { logoKey: data.key })
      window.dispatchEvent(new Event('branding-changed'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el logo.')
    }
    setUploading(null)
  }

  async function removeLogo(slug: string) {
    if (!window.confirm(`¿Estás seguro de que querés quitar el logo de esta agencia? Quedará el logo por defecto de la plataforma.`)) return
    setUploading(slug)
    setError(null)
    try {
      // Delete the object (best-effort: it may already be gone) and clear the DB key.
      await removeLogoObject(`logos/${slug}.webp`)
      await configApi.updateBranding(slug, { logoKey: null })
      window.dispatchEvent(new Event('branding-changed'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el logo.')
    }
    setUploading(null)
  }

  /** Storage remove treats a missing object as success: a stale/cleaned key must never block upload or removal. */
  async function removeLogoObject(key: string) {
    const { error } = await insforge.storage.from(BRANDING_BUCKET).remove(key)
    const notFound = error?.statusCode === 404 || error?.error === 'STORAGE_NOT_FOUND' || /Object not found/i.test(String(error?.message ?? ''))
    if (error && !notFound) throw error
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
                    src={`${a.logoUrl}?v=${encodeURIComponent(a.updatedAt)}`}
                    alt={`Logo de ${a.name}`}
                    class="h-12 w-12 rounded-md border border-gray-200 object-contain bg-white"
                  />
                ) : (
                  <img
                    src="/orbit-logo-version-finalv2.png"
                    alt="Logo por defecto (Orbit)"
                    class="h-12 w-12 rounded-md border border-gray-200 object-contain bg-white p-1"
                  />
                )}
                <span class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  {a.logoUrl ? 'Logo actual' : 'Logo por defecto (Orbit)'}
                </span>
              </div>
              <div class="flex-1">
                <div class="mb-1 text-lg font-semibold text-gray-800">{a.name}</div>
                <div class="text-xs text-gray-500">
                  {a.slug} {a.logoUrl ? '· logo personalizado' : '· sin logo personalizado'}
                </div>
                <div class="mt-1 text-[11px] text-gray-400">
                  Formatos: PNG, JPG o WebP. Se optimizan a WebP ≤512px; solo imágenes son elegibles para renderizar.
                </div>
              </div>

              {editable && (
                <div class="flex flex-col gap-2">
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
                  {a.logoUrl && (
                    <button
                      type="button"
                      onClick={() => void removeLogo(a.slug)}
                      disabled={uploading !== null}
                      class="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Ban class="h-4 w-4" aria-hidden="true" />
                      Quitar logo
                    </button>
                  )}
                </div>
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
  fixed: 'Cuota fija (por carga)',
}

/** Groups the rate list by billing kind; each group owns its default tariff. */
const RATE_KINDS: PriceModel[] = ['weight', 'fixed', 'volume']
const KIND_LABEL: Record<PriceModel, string> = {
  weight: 'Por peso',
  fixed: 'Cuota fija',
  volume: 'Por volumen',
}
const KIND_HINT: Record<PriceModel, string> = {
  weight: 'Se cobra por libra con la tarifa del cliente o la de la agencia.',
  fixed: 'Monto fijo por carga, sin importar el peso. Aéreo y Marítimo tienen su propio precio.',
  volume: 'Cobro por pie cúbico. Todavía en pruebas.',
}

/** One editable card = the two AIR/MAR entries of the current published version.
 *  Fixed cards have no per-entry name: the table name is the service name. */
type CardDraft = {
  air: { name: string; price: string; cost: string }
  mar: { name: string; price: string; cost: string }
}

function toCardDraft(card: RateCardInfo): CardDraft {
  const entry = (s: 'AIR' | 'MAR') => card.currentVersion.entries.find((e) => e.serviceType === s)
  const a = entry('AIR')
  const m = entry('MAR')
  return {
    air: { name: a?.name ?? '', price: a ? String(a.price) : '', cost: a ? String(a.cost) : '' },
    mar: { name: m?.name ?? '', price: m ? String(m.price) : '', cost: m ? String(m.cost) : '' },
  }
}

/** Both entries must be complete — a card is a single AIR/MAR pair. Fixed cards
 *  stamp the table name on the entries so no generic "Regular" row is stored. */
function draftToEntries(d: CardDraft, tableName: string, isFixed: boolean): RateCardEntryInput[] {
  const out: RateCardEntryInput[] = []
  for (const key of ['air', 'mar'] as const) {
    const f = d[key]
    if (f.price === '') continue
    out.push({
      serviceType: key === 'air' ? 'AIR' : 'MAR',
      name: isFixed ? tableName : f.name.trim() || 'Regular',
      price: Number(f.price) || 0,
      cost: f.cost === '' ? 0 : Number(f.cost) || 0,
    })
  }
  return out
}

type EditDraft = {
  id: string
  originalName: string
  pricingKind: PriceModel
  isDefault: boolean
  makeDefault: boolean
  name: string
  air: { name: string; price: string; cost: string }
  mar: { name: string; price: string; cost: string }
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
  const [newIsDefault, setNewIsDefault] = useState(false)
  /** Prices typed at creation (a default must be priced; empty = draft card). */
  const [newAirPrice, setNewAirPrice] = useState('')
  const [newMarPrice, setNewMarPrice] = useState('')
  const [newAirCost, setNewAirCost] = useState('')
  const [newMarCost, setNewMarCost] = useState('')
  /** Active billing-kind tab: one group of cards visible at a time. */
  const [activeKind, setActiveKind] = useState<PriceModel>('weight')
  /** Small informational modal (e.g. a zeroed tariff is not allowed). */
  const [info, setInfo] = useState<{ title: string; message: string; tone?: 'danger' | 'warning' | 'info' } | null>(null)
  /** Flexible pricing pilot: fixed cards + per-kind defaults only when enabled. */
  const [flexible, setFlexible] = useState(false)
  /** One editing surface per card: name + both prices + default + delete. */
  const [edit, setEdit] = useState<EditDraft | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'save'; id: string; name: string } | null>(null)
  const [notice, setNotice] = useState<{ title: string; message?: string } | null>(null)
  // The Worker resolves the organization from the session (never the payload).
  const agency = user.agency

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rates, info, features] = await Promise.all([
        configApi.listRateCards(),
        configApi.info().catch(() => null),
        configApi.features().catch(() => ({ flexiblePricing: false })),
      ])
      setCards(rates.cards)
      setFlexible(features.flexiblePricing)
      if (info) setCurrency(info.currency)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las tarifas.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [agency, load])

  // The fixed-fee tab only exists for agencies with the pilot flag on.
  useEffect(() => {
    if (activeKind === 'fixed' && !flexible) setActiveKind('weight')
  }, [activeKind, flexible])

  const showError = (e: unknown) => setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.')
  const showNotice = (title: string, message?: string) => setNotice({ title, message })

  // Only weight and fixed have UI today; volume stays announced but disabled.
  const kinds = RATE_KINDS.filter((k) => k !== 'volume' && (k !== 'fixed' || flexible))
  const kind = kinds.includes(activeKind) ? activeKind : kinds[0]
  const cardsOf = (k: PriceModel) => cards.filter((c) => (c.pricingKind ?? 'weight') === k)
  // The default always leads its group: the owner sees it first without hunting.
  const sortGroup = (list: RateCardInfo[]) =>
    [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
  /** A tariff with any zero price would bill $0: never allowed as default. */
  const cardHasPrices = (card: RateCardInfo) =>
    card.currentVersion.entries.length > 0 && card.currentVersion.entries.every((e) => Number(e.price) > 0)

  function openEdit(card: RateCardInfo) {
    const draft = toCardDraft(card)
    setEdit({
      id: card.id,
      originalName: card.name,
      pricingKind: card.pricingKind ?? 'weight',
      isDefault: !!card.isDefault,
      makeDefault: false,
      name: card.name,
      air: draft.air,
      mar: draft.mar,
    })
  }

  function updateField(key: 'air' | 'mar', field: 'name' | 'price' | 'cost', value: string) {
    setEdit((prev) => (prev ? { ...prev, [key]: { ...prev[key], [field]: value } } : prev))
  }

  async function createCard() {
    if (!newName.trim() || newModel === 'volume' || (newModel === 'fixed' && !flexible)) return
    const num = (v: string) => (v.trim() === '' ? 0 : Number(v) || 0)
    const entryName = newModel === 'fixed' ? newName.trim() : 'Regular'
    const air = { name: entryName, price: num(newAirPrice), cost: num(newAirCost) }
    const mar = { name: entryName, price: num(newMarPrice), cost: num(newMarCost) }
    // Creating a table with a zero/empty price would bill $0 for its whole
    // group, so the form never saves one. The reason is the same one shown
    // inline next to the button.
    if (air.price <= 0 || mar.price <= 0 || air.cost <= 0 || mar.cost <= 0) {
      setInfo({
        title: 'No se puede crear la tabla',
        tone: 'warning',
        message:
          'El precio y el costo de Aéreo y Marítimo deben ser mayores a 0. Una tabla en cero o vacía no se guarda: se cobraría $0 y el cobro de los paquetes quedaría sin sustento.',
      })
      return
    }
    setError(null)
    try {
      const created = await configApi.createRateCard({
        name: newName.trim(),
        priceModel: newModel,
        isDefault: newIsDefault,
        entries: [
          { serviceType: 'AIR', ...air },
          { serviceType: 'MAR', ...mar },
        ],
      })
      if (created.isDefault) {
        // Making the new card default clears the previous one: re-read the list so
        // both flags land at once and the new default shows on top of its group.
        const fresh = await configApi.listRateCards().catch(() => null)
        setCards(fresh ? fresh.cards : [...cards.map((c) => (c.pricingKind === created.pricingKind ? { ...c, isDefault: false } : c)), created])
      } else {
        setCards((prev) => [...prev, created])
      }
      setActiveKind(created.pricingKind)
      setCreateOpen(false)
      setNewName('')
      setNewModel(kind)
      setNewIsDefault(false)
      setNewAirPrice('0')
      setNewMarPrice('0')
      setNewAirCost('0')
      setNewMarCost('0')
      const defaultNote = created.isDefault ? ' Ya es la tarifa por defecto de su tipo de cobro.' : ''
      showNotice(`Tabla creada en ${KIND_LABEL[created.pricingKind] ?? 'su grupo'}`, `"${created.name}" ya está disponible.${defaultNote}`)
    } catch (e) {
      showError(e)
    }
  }

  /** Validate the draft, then ask for confirmation like the rest of the CRUD. */
  function requestSave() {
    if (!edit) return
    const name = edit.name.trim()
    if (!name) {
      setInfo({ title: 'Falta el nombre', message: 'Poné un nombre para identificar la tabla dentro de su tipo de cobro.' })
      return
    }
    // Zero never saves, default or not: a non-default table can still be
    // assigned to a client and would bill $0 there.
    const moneyOk = (v: string) => v.trim() !== '' && Number(v) > 0
    if (!moneyOk(edit.air.price) || !moneyOk(edit.mar.price) || !moneyOk(edit.air.cost) || !moneyOk(edit.mar.cost)) {
      setInfo({
        title: 'Tarifa en cero',
        tone: 'warning',
        message:
          'El precio y el costo de Aéreo y Marítimo deben ser mayores a 0. Una tabla en cero no se guarda: se cobraría $0 y el cobro de los paquetes quedaría sin sustento.',
      })
      return
    }
    setConfirm({ kind: 'save', id: edit.id, name })
  }

  function requestDelete(id: string, name: string) {
    setConfirm({ kind: 'delete', id, name })
  }

  async function runConfirm() {
    const c = confirm
    if (!c) return
    setError(null)
    try {
      if (c.kind === 'delete') {
        setSaving(c.id)
        await configApi.deleteRateCard(c.id)
        setCards((prev) => prev.filter((x) => x.id !== c.id))
        if (edit?.id === c.id) setEdit(null)
        showNotice('Tabla eliminada', `"${c.name}" ya no está disponible para nuevos paquetes.`)
      } else {
        if (!edit) return
        setSaving(c.id)
        const isFixed = edit.pricingKind === 'fixed'
        const entries = draftToEntries(edit, edit.name.trim(), isFixed)
        await configApi.replaceCardEntries(c.id, entries)
        if (edit.name.trim() !== edit.originalName) {
          await configApi.renameRateCard(c.id, edit.name.trim())
        }
        if (edit.makeDefault) {
          await configApi.setRateCardDefault(c.id)
        }
        // One read keeps both the default flags and the fresh entries consistent.
        const fresh = await configApi.listRateCards()
        setCards(fresh.cards)
        setEdit(null)
        showNotice(
          'Cambios guardados',
          edit.makeDefault ? `"${c.name}" es ahora la tarifa por defecto de su tipo de cobro.` : `Las tarifas de "${c.name}" se actualizaron.`,
        )
      }
    } catch (e) {
      showError(e)
    } finally {
      setSaving(null)
      setConfirm(null)
    }
  }

  if (loading && cards.length === 0) return <Spinner label="Cargando tarifas…" />

  // One tab per billing kind: only the active group is shown, and the tab itself
  // carries that group's default so the owner sees it without opening anything.
  const activeCards = sortGroup(cardsOf(kind))
  const activeDefault = activeCards.find((c) => c.isDefault)
  const entryPriceLabel = (isFixed: boolean) => (isFixed ? `Precio por carga (${currency})` : `Precio por libra (${currency})`)
  const entryCostLabel = (isFixed: boolean) => (isFixed ? `Costo por carga (${currency})` : `Costo por libra (${currency})`)

  // Money fields start at 0 so the empty state is explicit: the create button
  // stays blocked until every one of them is a real, positive amount.
  const moneyMissing = (v: string) => v.trim() === '' || !(Number(v) > 0)
  const createBlockedReason = (() => {
    if (!newName.trim()) return 'Poné un nombre para la tabla.'
    if (newModel === 'volume') return 'El cobro por volumen todavía está en pruebas.'
    if (newModel === 'fixed' && !flexible) return 'La cuota fija no está habilitada para esta agencia.'
    if (moneyMissing(newAirPrice)) return 'El precio de Aéreo debe ser mayor a 0.'
    if (moneyMissing(newMarPrice)) return 'El precio de Marítimo debe ser mayor a 0.'
    if (moneyMissing(newAirCost)) return 'El costo de Aéreo debe ser mayor a 0.'
    if (moneyMissing(newMarCost)) return 'El costo de Marítimo debe ser mayor a 0.'
    return null
  })()

  return (
    <div class="flex flex-col gap-5">
      {error && <p class="text-sm text-red-600">{error}</p>}
      <Toast open={notice !== null} title={notice?.title ?? ''} message={notice?.message} onClose={() => setNotice(null)} />

      {canWrite && (
        <Card class="p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-gray-800">Tablas de tarifas</div>
              <p class="text-xs text-gray-500">
                Cada tabla es un plan con dos precios: Aéreo y Marítimo. Elegí el tipo de cobro para ver y editar sus
                tarifas; cada tipo tiene su propia tarifa por defecto.
              </p>
            </div>
            <Button
              onClick={() => {
                setNewModel(kind)
                setNewIsDefault(false)
                setNewAirPrice('0')
                setNewMarPrice('0')
                setNewAirCost('0')
                setNewMarCost('0')
                setCreateOpen(true)
              }}
            >
              <Plus class="h-4 w-4" aria-hidden="true" />
              Nueva tabla
            </Button>
          </div>
        </Card>
      )}

      {/* Billing-kind tabs: all three stay on one row on desktop. */}
      <div class="grid gap-2 md:grid-cols-3" role="tablist" aria-label="Tipo de cobro">
        {kinds.map((k) => {
          const groupCards = cardsOf(k)
          const def = groupCards.find((c) => c.isDefault)
          const active = k === kind
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveKind(k)}
              class={`flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                active
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <span class="flex w-full items-center justify-between gap-2">
                <span class="text-sm font-semibold">{KIND_LABEL[k]}</span>
                <span class={`rounded-full px-2 py-0.5 text-[11px] font-medium ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {groupCards.length} {groupCards.length === 1 ? 'tabla' : 'tablas'}
                </span>
              </span>
              <span class={`text-[11px] ${active ? 'text-white/80' : 'text-gray-500'}`}>{KIND_HINT[k]}</span>
              <span class={`text-[11px] font-medium ${active ? 'text-white' : def ? 'text-emerald-700' : 'text-amber-700'}`}>
                {def ? `Por defecto: ${def.name}` : 'Sin tarifa por defecto'}
              </span>
            </button>
          )
        })}
        <div class="flex flex-col items-start gap-0.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-left opacity-70">
          <span class="text-sm font-semibold text-gray-500">{KIND_LABEL.volume}</span>
          <span class="text-[11px] text-gray-400">{KIND_HINT.volume}</span>
        </div>
      </div>

      <section key={kind} class="flex flex-col gap-2" role="tabpanel" aria-label={KIND_LABEL[kind]}>
        <div class="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 px-1">
          <div>
            <h3 class="text-base font-semibold text-secondary">{KIND_LABEL[kind]}</h3>
            <p class="text-xs text-gray-500">{KIND_HINT[kind]}</p>
          </div>
          <span class={`text-xs font-medium ${activeDefault ? 'text-emerald-700' : 'text-amber-700'}`}>
            {activeDefault ? `Por defecto: ${activeDefault.name}` : 'Sin tarifa por defecto en este grupo'}
          </span>
        </div>

        {activeCards.length === 0 && (
          <Card>
            <p class="p-4 text-sm text-gray-500">
              No hay tablas de {KIND_LABEL[kind].toLowerCase()} todavía. Creá una con “Nueva tabla”.
            </p>
          </Card>
        )}

        <div class="grid gap-3 lg:grid-cols-2">
          {activeCards.map((card) => {
            const isFixed = card.currentVersion.priceModel === 'fixed'
            const entryOf = (s: 'AIR' | 'MAR') => card.currentVersion.entries.find((e) => e.serviceType === s)
            return (
              <Card key={card.id} class="flex flex-col">
                <div class="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
                  <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span class="truncate text-sm font-semibold text-gray-800">{card.name}</span>
                    {card.isDefault && <span class="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">Por defecto</span>}
                  </div>
                  {canWrite && (
                    <Button variant="ghost" onClick={() => openEdit(card)}>
                      <Pencil class="h-4 w-4" aria-hidden="true" />
                      Editar
                    </Button>
                  )}
                </div>
                <div class="grid flex-1 gap-3 p-4 sm:grid-cols-2">
                  {(['air', 'mar'] as const).map((key) => {
                    const service = key === 'air' ? 'AIR' : 'MAR'
                    const entry = entryOf(service)
                    const label = key === 'air' ? 'Aéreo' : 'Marítimo'
                    // Fixed services have no per-entry name; a weight card's entry
                    // name is its tier, shown only when it adds information.
                    const tier = !isFixed && entry?.name && entry.name !== 'Regular' && entry.name !== card.name ? entry.name : null
                    return (
                      <div key={key} class="rounded-lg border border-gray-100 p-3">
                        <div class="mb-2 flex items-center gap-1.5">
                          <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">{label}</span>
                          {tier && <span class="truncate text-[11px] text-gray-400">{tier}</span>}
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div class="text-xs text-gray-400">{entryPriceLabel(isFixed)}</div>
                            <div class="py-1.5 font-medium text-gray-700">{fmtMoney(Number(entry?.price ?? 0), currency)}</div>
                          </div>
                          <div>
                            <div class="text-xs text-gray-400">{entryCostLabel(isFixed)}</div>
                            <div class="py-1.5 text-gray-500">{fmtMoney(Number(entry?.cost ?? 0), currency)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {cards.length === 0 && (
        <Card>
          <p class="p-4 text-sm text-gray-500">No hay tablas de tarifas para esta organización.</p>
        </Card>
      )}

      {canWrite && (
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva tabla de tarifas" size="sm">
          <div class="flex flex-col gap-4">
            <Field label="Nombre">
              <input class={inputCls} value={newName} placeholder="Ej. Estándar" autoFocus onChange={(e) => setNewName((e.target as HTMLInputElement).value)} />
            </Field>
            <Field label="Tipo de cobro">
              <select class={inputCls} value={newModel} onChange={(e) => setNewModel((e.target as HTMLSelectElement).value as PriceModel)}>
                <option value="weight">{PRICE_MODEL_LABELS.weight}</option>
                {flexible && <option value="fixed">{PRICE_MODEL_LABELS.fixed}</option>}
                <option value="volume" disabled>
                  {PRICE_MODEL_LABELS.volume} (próximamente)
                </option>
              </select>
            </Field>
            {newModel === 'fixed' && (
              <p class="text-xs text-gray-500">
                Servicio con monto fijo por carga: el cliente paga el precio y el costo interno lo definís vos. El peso no
                participa en el cobro.
              </p>
            )}
            <div class="grid grid-cols-2 gap-3">
              {([
                { key: 'air', label: 'Aéreo', price: newAirPrice, setPrice: setNewAirPrice, cost: newAirCost, setCost: setNewAirCost },
                { key: 'mar', label: 'Marítimo', price: newMarPrice, setPrice: setNewMarPrice, cost: newMarCost, setCost: setNewMarCost },
              ] as const).map((s) => (
                <div key={s.key} class="rounded-lg border border-gray-100 p-3">
                  <div class="mb-2 text-xs font-semibold text-gray-600">{s.label}</div>
                  <Field label={newModel === 'fixed' ? `Precio por carga (${currency})` : `Precio por libra (${currency})`}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      class={inputCls}
                      value={s.price}
                      placeholder="0.00"
                      onInput={(e) => s.setPrice((e.target as HTMLInputElement).value)}
                    />
                  </Field>
                  <div class="mt-2">
                    <Field label={newModel === 'fixed' ? `Costo por carga (${currency})` : `Costo por libra (${currency})`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        class={inputCls}
                        value={s.cost}
                        placeholder="0.00"
                        onInput={(e) => s.setCost((e.target as HTMLInputElement).value)}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            {flexible && (
              <label class="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={newIsDefault} onChange={(e) => setNewIsDefault((e.target as HTMLInputElement).checked)} />
                Marcar como tarifa por defecto de este tipo de cobro
              </label>
            )}
            {createBlockedReason ? (
              <p class="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800" role="status">
                {createBlockedReason}
              </p>
            ) : (
              <p class="text-xs text-gray-500">
                {newIsDefault
                  ? 'La tabla entra en uso de inmediato como tarifa por defecto.'
                  : 'Una tabla nueva se guarda completa: los cuatro montos deben ser mayores a 0.'}
              </p>
            )}
            <div class="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Tooltip text={createBlockedReason ?? 'Crear la tabla de tarifas'}>
                <span>
                  <Button onClick={createCard} disabled={createBlockedReason !== null}>
                    <Plus class="h-4 w-4" aria-hidden="true" />
                    Crear
                  </Button>
                </span>
              </Tooltip>
            </div>
          </div>
        </Modal>
      )}

      {/* Single editing surface: name, both prices/costs, default and delete. */}
      {canWrite && (
        <Modal open={edit !== null} onClose={() => setEdit(null)} title="Editar tabla de tarifas" size="md">
          {edit && (
            <div class="flex flex-col gap-4">
              <Field label="Nombre de la tabla">
                <input class={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: (e.target as HTMLInputElement).value })} />
              </Field>
              <div class="grid grid-cols-2 gap-3">
                {(['air', 'mar'] as const).map((key) => {
                  const f = edit[key]
                  const label = key === 'air' ? 'Aéreo' : 'Marítimo'
                  const isFixed = edit.pricingKind === 'fixed'
                  return (
                    <div key={key} class="rounded-lg border border-gray-100 p-3">
                      <div class="mb-2 text-xs font-semibold text-gray-600">{label}</div>
                      {!isFixed && (
                        <div class="mb-2">
                          <Field label="Categoría">
                            <input class={inputCls} value={f.name} placeholder="Regular" onChange={(e) => updateField(key, 'name', (e.target as HTMLInputElement).value)} />
                          </Field>
                        </div>
                      )}
                      <Field label={entryPriceLabel(isFixed)}>
                        <input type="number" min="0" step="0.01" class={inputCls} value={f.price} placeholder="0.00" onInput={(e) => updateField(key, 'price', (e.target as HTMLInputElement).value)} />
                      </Field>
                      <div class="mt-2">
                        <Field label={entryCostLabel(isFixed)}>
                          <input type="number" min="0" step="0.01" class={inputCls} value={f.cost} placeholder="0.00" onInput={(e) => updateField(key, 'cost', (e.target as HTMLInputElement).value)} />
                        </Field>
                      </div>
                    </div>
                  )
                })}
              </div>
              {flexible && !edit.isDefault && (
                <label class="flex items-start gap-2 text-sm text-gray-700">
                  <input class="mt-0.5" type="checkbox" checked={edit.makeDefault} onChange={(e) => setEdit({ ...edit, makeDefault: (e.target as HTMLInputElement).checked })} />
                  <span>
                    Usar como tarifa por defecto de este tipo de cobro
                    <span class="block text-xs text-gray-500">Necesita precio de Aéreo y Marítimo mayor a 0.</span>
                  </span>
                </label>
              )}
              {edit.isDefault && (
                <p class="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Esta es la tarifa por defecto de su tipo de cobro. Sus precios no pueden quedar en cero.
                </p>
              )}
              <div class="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <Button variant="ghost" class="text-red-600" onClick={() => requestDelete(edit.id, edit.name.trim() || edit.originalName)}>
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                  Eliminar tabla
                </Button>
                <div class="flex gap-2">
                  <Button variant="ghost" onClick={() => setEdit(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={requestSave} disabled={saving === edit.id}>
                    <Save class="h-4 w-4" aria-hidden="true" />
                    Guardar cambios
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      <AlertDialog
        open={info !== null}
        onClose={() => setInfo(null)}
        title={info?.title ?? ''}
        tone={info?.tone ?? 'warning'}
        label="Entendido"
      >
        {info?.message}
      </AlertDialog>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        variant={confirm?.kind === 'delete' ? 'danger' : 'warning'}
        title={confirm?.kind === 'delete' ? 'Eliminar tabla' : 'Guardar cambios en la tarifa'}
        message={
          confirm?.kind === 'delete'
            ? `¿Eliminar "${confirm.name}"? Los paquetes que ya la usaron conservan su cobro; esta acción se registra en el historial de auditoría.`
            : `¿Aplicar los cambios de "${confirm?.name}"? Las próximas facturas de su tipo de cobro usarán los precios guardados. Esta acción se registra en el historial de auditoría.`
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Eliminar' : 'Guardar cambios'}
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
