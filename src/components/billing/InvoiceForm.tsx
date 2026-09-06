import { Plus, Trash2, X } from 'lucide-preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { billingApi, type CatalogEntry, type CreateInvoiceInput, type FreightType, type InvoiceView, type PriceTier } from '../../lib/billing'
import { configApi, type ChargeConcept, type RateTableInfo } from '../../lib/config'
import type { Customer } from '../../lib/customer'
import { FREIGHT_LABEL, fmtMoney, FREIGHT_LABEL as FL, TIER_LABEL } from '../../lib/format'
import { Button, Card, Field, inputCls, SectionTitle, Spinner } from '../ui'
import ClientSearch from '../ui/ClientSearch'

interface DraftLine {
  freightType: FreightType
  tier: PriceTier
  quantityLbs: string
  description: string
  /** Explicit rate table (overrides the client's default). null = client default. */
  rateTableId: string | null
}

interface DraftOther {
  conceptId: string
  extra: string
  amount: string
}

const FREIGHTS: FreightType[] = ['AIR', 'MAR']
// Legacy catalog tiers — fallback when the agency has no rate tables yet.
const LEGACY_TIERS: PriceTier[] = ['REGULAR', 'ESPECIAL', 'VIP', 'MADRES', 'DARIO']

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function tierPriceFromTable(table: RateTableInfo, tier: PriceTier): number | null {
  const row = table.rows.find((r) => r.tier === tier)
  return row && row.price != null ? row.price : null
}

function tableCost(tables: RateTableInfo[], tableId: string): number {
  return tables.find((t) => t.id === tableId)?.rows.find((r) => r.cost != null)?.cost ?? 0
}

/** Create-invoice modal. Freight lines pick an explicit rate table ("Estándar -
 *  Aéreo", "Estándar - Marítimo"…) or leave "(tarifa del cliente)" so the server
 *  applies the client's default. Extra charges ("otros") reference agency-managed
 *  concepts with an admin-set amount. The server recomputes everything. */
export default function InvoiceForm({
  prefill,
  onClose,
  onCreated,
}: {
  prefill?: Partial<CreateInvoiceInput>
  onClose: () => void
  onCreated: (v: InvoiceView) => void
}) {
  const [rateTables, setRateTables] = useState<RateTableInfo[]>([])
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [concepts, setConcepts] = useState<ChargeConcept[]>([])
  const [clientName, setClientName] = useState(prefill?.clientName ?? '')
  const [issueDate, setIssueDate] = useState(prefill?.issueDate ?? new Date().toISOString().slice(0, 10))
  const [observations, setObservations] = useState('')
  const [lines, setLines] = useState<DraftLine[]>(
    prefill?.lines?.map((l) => ({ freightType: l.freightType, tier: l.tier, quantityLbs: String(l.quantityLbs), description: l.description ?? '', rateTableId: l.rateTableId ?? null })) ?? [
      { freightType: 'AIR', tier: 'REGULAR', quantityLbs: '', description: '', rateTableId: null },
    ],
  )
  const [others, setOthers] = useState<DraftOther[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    configApi
      .listRates()
      .then(({ tables }) => setRateTables(tables))
      .catch(() => setRateTables([]))
    configApi
      .chargeConcepts()
      .then((cs) => setConcepts(cs.filter((c) => c.active)))
      .catch(() => setConcepts([]))
    billingApi.catalog().then(setCatalog).catch(() => setErr('No se pudo cargar el catálogo.'))
  }, [])

  const activeConcepts = useMemo(() => concepts.filter((c) => c.active), [concepts])

  // Tables for a freight, labeled "Estándar - Aéreo" (the owner's requested UX).
  const tablesFor = (f: FreightType) => rateTables.filter((t) => t.freightType === f)
  const tableLabel = (t: RateTableInfo) => `${t.name} - ${FREIGHT_LABEL[t.freightType]}`

  /** Tiers available for a line: the chosen table's rows, catalog fallback when
   *  the agency has no tables for that freight. */
  function tiersFor(freightType: FreightType, rateTableId: string | null): PriceTier[] {
    if (rateTableId) {
      const t = rateTables.find((x) => x.id === rateTableId)
      if (t) return t.rows.map((r) => r.tier)
    }
    if (rateTables.some((x) => x.freightType === freightType)) return []
    const entry = catalog.find((c) => c.freightType === freightType)
    return entry ? LEGACY_TIERS.filter((t) => entry.tiers[t] != null) : []
  }

  function lineAmounts(l: DraftLine): { unitPrice: number | null; total: number; profit: number } {
    const lbs = Number(l.quantityLbs) || 0
    if (l.rateTableId) {
      const table = rateTables.find((t) => t.id === l.rateTableId)
      const price = table ? tierPriceFromTable(table, l.tier) : null
      if (price == null) return { unitPrice: null, total: 0, profit: 0 }
      const total = round2(lbs * price)
      const profit = round2(total - lbs * tableCost(rateTables, l.rateTableId))
      return { unitPrice: price, total, profit }
    }
    // Client default / legacy: catalog preview (the server resolves the real table).
    const entry = catalog.find((c) => c.freightType === l.freightType)
    const price = entry?.tiers[l.tier]
    if (price == null) return { unitPrice: null, total: 0, profit: 0 }
    const total = round2(lbs * price)
    const profit = round2(total - lbs * (entry?.cost ?? 0))
    return { unitPrice: price, total, profit }
  }

  function otherAmount(o: DraftOther): number {
    const concept = activeConcepts.find((c) => c.id === o.conceptId)
    return Number(o.amount) || concept?.suggestedPrice || 0
  }

  const totals = useMemo(() => {
    let total = 0
    let profit = 0
    for (const l of lines) {
      const a = lineAmounts(l)
      total += a.total
      profit += a.profit
    }
    for (const o of others) total += otherAmount(o)
    return { total: round2(total), profit: round2(profit) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, others, rateTables, catalog, activeConcepts])

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function addFreightLine() {
    setLines((ls) => [...ls, { freightType: 'AIR', tier: 'REGULAR', quantityLbs: '', description: '', rateTableId: null }])
  }

  function addOtherLine() {
    const concept = activeConcepts[0]
    setOthers((os) => [...os, { conceptId: concept?.id ?? '', extra: '', amount: concept?.suggestedPrice != null ? String(concept.suggestedPrice) : '' }])
  }

  async function submit() {
    setErr(null)
    if (!clientName.trim()) return setErr('El cliente es obligatorio.')
    const cleanLines = lines
      .map((l) => ({ freightType: l.freightType, tier: l.tier, quantityLbs: Number(l.quantityLbs), description: l.description || null, rateTableId: l.rateTableId }))
      .filter((l) => l.quantityLbs > 0)
    if (cleanLines.length === 0) return setErr('Agrega al menos una línea con peso.')
    const cleanOthers = others
      .map((o) => ({ conceptId: o.conceptId || null, description: o.extra || null, amount: otherAmount(o) }))
      .filter((o) => o.amount > 0)
    if (!window.confirm('¿Generar la factura? Se creará con los datos ingresados.')) return
    setSaving(true)
    try {
      const view = await billingApi.createInvoice({
        clientName: clientName.trim(),
        issueDate,
        observations: observations || null,
        lines: cleanLines,
        otherLines: cleanOthers,
        packageIds: prefill?.packageIds,
      })
      window.alert(`Factura #${view.invoiceNumber} creada exitosamente.`)
      onCreated(view)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo crear la factura.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:hidden">
      <Card class="my-8 w-full max-w-2xl">
        <SectionTitle class="justify-between">
          <span>Nueva factura</span>
          <button onClick={onClose} aria-label="Cerrar" class="text-gray-400 hover:text-gray-700">
            <X class="h-4 w-4" />
          </button>
        </SectionTitle>
        <div class="space-y-4 p-5">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cliente">
              <ClientSearch
                value={clientName}
                onSelect={(c: Customer) => setClientName(c.name)}
                onClear={() => setClientName('')}
                allowCreate
                placeholder="Nombre del cliente"
              />
            </Field>
            <Field label="Fecha de emisión">
              <input type="date" class={inputCls} value={issueDate} onInput={(e) => setIssueDate((e.target as HTMLInputElement).value)} />
            </Field>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Líneas de flete</div>
            {lines.map((l, i) => {
              const a = lineAmounts(l)
              const tiers = tiersFor(l.freightType, l.rateTableId)
              const tables = tablesFor(l.freightType)
              return (
                <div key={i} class="rounded-lg border border-gray-100 p-2">
                  <div class="grid grid-cols-12 items-end gap-2">
                    <label class="col-span-3 text-[11px] text-gray-500">
                      Flete
                      <select class={`${inputCls} mt-1 w-full`} value={l.freightType} onChange={(e) => setLine(i, { freightType: (e.target as HTMLSelectElement).value as FreightType, rateTableId: null, tier: tiersFor((e.target as HTMLSelectElement).value as FreightType, null)[0] ?? 'REGULAR' })}>
                        {FREIGHTS.map((f) => <option key={f} value={f}>{FREIGHT_LABEL[f]}</option>)}
                      </select>
                    </label>
                    <label class="col-span-4 text-[11px] text-gray-500">
                      Tarifa
                      <select class={`${inputCls} mt-1 w-full`} value={l.rateTableId ?? ''} onChange={(e) => {
                        const id = (e.target as HTMLSelectElement).value || null
                        const table = id ? rateTables.find((t) => t.id === id) : null
                        setLine(i, { rateTableId: id, tier: table?.rows[0]?.tier ?? 'REGULAR' })
                      }}>
                        <option value="">(tarifa del cliente)</option>
                        {tables.map((t) => <option key={t.id} value={t.id}>{tableLabel(t)}</option>)}
                      </select>
                    </label>
                    <label class="col-span-2 text-[11px] text-gray-500">
                      Libras
                      <input type="number" min="0" step="0.01" class={`${inputCls} mt-1 w-full`} value={l.quantityLbs} onInput={(e) => setLine(i, { quantityLbs: (e.target as HTMLInputElement).value })} />
                    </label>
                    <div class="col-span-2 pb-2 text-right text-sm">
                      <div class="font-semibold text-secondary">{a.unitPrice == null ? 'N/A' : fmtMoney(a.total, 'USD')}</div>
                      <div class="text-[11px] text-gray-400">{a.unitPrice == null ? 'tarifa no aplica' : `${fmtMoney(a.unitPrice, 'USD')}/lb`}</div>
                    </div>
                    <button class="col-span-1 pb-2 text-gray-300 hover:text-red-500" aria-label="Quitar línea" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                  {tiers.length > 0 && (
                    <div class="mt-2 flex items-center gap-2">
                      <span class="text-[11px] text-gray-400">Tier:</span>
                      <select class={`${inputCls} w-auto text-xs`} value={l.tier} onChange={(e) => setLine(i, { tier: (e.target as HTMLSelectElement).value })}>
                        {tiers.map((t) => <option key={t} value={t}>{TIER_LABEL[t] ?? t}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
            <Button variant="ghost" onClick={addFreightLine}>
              <Plus class="h-4 w-4" /> Agregar línea de flete
            </Button>
          </div>

          {activeConcepts.length > 0 && (
            <div class="space-y-2">
              <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Otros cargos</div>
              {others.map((o, i) => {
                const concept = activeConcepts.find((c) => c.id === o.conceptId) ?? activeConcepts[0]
                return (
                  <div key={i} class="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-100 p-2">
                    <label class="col-span-4 text-[11px] text-gray-500">
                      Concepto
                      <select class={`${inputCls} mt-1 w-full`} value={o.conceptId} onChange={(e) => {
                        const c = activeConcepts.find((x) => x.id === (e.target as HTMLSelectElement).value)
                        setOthers((os) => os.map((x, idx) => (idx === i ? { ...x, conceptId: c?.id ?? '', amount: c?.suggestedPrice != null ? String(c.suggestedPrice) : x.amount } : x)))
                      }}>
                        {activeConcepts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label class="col-span-3 text-[11px] text-gray-500">
                      Detalle (opcional)
                      <input class={`${inputCls} mt-1 w-full`} value={o.extra} onChange={(e) => setOthers((os) => os.map((x, idx) => (idx === i ? { ...x, extra: (e.target as HTMLInputElement).value } : x)))} />
                    </label>
                    <label class="col-span-3 text-[11px] text-gray-500">
                      Monto
                      <input type="number" min="0" step="0.01" class={`${inputCls} mt-1 w-full`} value={o.amount} placeholder={concept?.suggestedPrice != null ? String(concept.suggestedPrice) : '0.00'} onInput={(e) => setOthers((os) => os.map((x, idx) => (idx === i ? { ...x, amount: (e.target as HTMLInputElement).value } : x)))} />
                    </label>
                    <button class="col-span-2 pb-2 text-gray-300 hover:text-red-500" aria-label="Quitar cargo" onClick={() => setOthers((os) => os.filter((_, idx) => idx !== i))}>
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
              <Button variant="ghost" onClick={addOtherLine}>
                <Plus class="h-4 w-4" /> Agregar otro cargo
              </Button>
            </div>
          )}

          <Field label="Observaciones">
            <textarea class={`${inputCls} min-h-[60px]`} value={observations} onInput={(e) => setObservations((e.target as HTMLTextAreaElement).value)} />
          </Field>

          <div class="flex items-center justify-between border-t border-gray-100 pt-3">
            <div class="text-sm">
              <span class="text-gray-500">Total </span>
              <span class="text-lg font-bold text-secondary">{fmtMoney(totals.total, 'USD')}</span>
              <span class="ml-3 text-gray-500">Ganancia </span>
              <span class="font-semibold text-green-700">{fmtMoney(totals.profit, 'USD')}</span>
            </div>
            <div class="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={submit} disabled={saving}>{saving ? <Spinner /> : 'Crear factura'}</Button>
            </div>
          </div>
          {err && <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        </div>
      </Card>
    </div>
  )
}
