import { Plus, Trash2, X } from 'lucide-preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { billingApi, type CatalogEntry, type CreateInvoiceInput, type FreightType, type InvoiceView, type PriceTier } from '../../lib/billing'
import { configApi, type RateTableInfo } from '../../lib/config'
import { FREIGHT_LABEL, fmtUsd, TIER_LABEL } from '../../lib/format'
import { Button, Card, Field, inputCls, SectionTitle, Spinner } from '../ui'

interface DraftLine {
  freightType: FreightType
  tier: PriceTier
  quantityLbs: string
  description: string
}

const FREIGHTS: FreightType[] = ['AIR', 'MAR']
// Legacy catalog tiers — fallback when the agency has no rate tables yet.
const LEGACY_TIERS: PriceTier[] = ['REGULAR', 'ESPECIAL', 'VIP', 'MADRES', 'DARIO']

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Dynamic tier pricing: the agency's rate tables are the source; the global
 *  catalog is the fallback. `tier` is free text — the server validates the combo. */
interface TierPrice {
  price: number
  cost: number
}

function tierPriceFromTables(tables: RateTableInfo[], freightType: FreightType, tier: PriceTier): TierPrice | null {
  for (const t of tables) {
    if (t.freightType !== freightType) continue
    const row = t.rows.find((r) => r.tier === tier)
    if (row && row.price != null) return { price: row.price, cost: row.cost ?? 0 }
  }
  return null
}

function tierPriceFromCatalog(catalog: CatalogEntry[], freightType: FreightType, tier: PriceTier): TierPrice | null {
  const entry = catalog.find((c) => c.freightType === freightType)
  const price = entry?.tiers[tier]
  if (price == null) return null
  return { price, cost: entry?.cost ?? 0 }
}

/** Create-invoice modal. Prices are computed live from the agency's rate tables
 *  (legacy catalog fallback) for feedback; the server recomputes authoritatively. */
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
  const [clientName, setClientName] = useState(prefill?.clientName ?? '')
  const [issueDate, setIssueDate] = useState(prefill?.issueDate ?? new Date().toISOString().slice(0, 10))
  const [observations, setObservations] = useState('')
  const [lines, setLines] = useState<DraftLine[]>(
    prefill?.lines?.map((l) => ({ freightType: l.freightType, tier: l.tier, quantityLbs: String(l.quantityLbs), description: l.description ?? '' })) ?? [
      { freightType: 'AIR', tier: 'REGULAR', quantityLbs: '', description: '' },
    ],
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    configApi
      .listRates()
      .then(({ tables }) => setRateTables(tables))
      .catch(() => setRateTables([]))
    billingApi.catalog().then(setCatalog).catch(() => setErr('No se pudo cargar el catálogo.'))
  }, [])

  // Tier options per freight: the agency's rate tables first, legacy tiers as fallback.
  const tiersByFreight = useMemo(() => {
    const out: Record<FreightType, PriceTier[]> = { AIR: [], MAR: [] }
    for (const f of FREIGHTS) {
      const dynamic = [...new Set(rateTables.filter((t) => t.freightType === f).flatMap((t) => t.rows.map((r) => r.tier)))]
      const legacy = LEGACY_TIERS.filter((t) => {
        const fromTables = dynamic.length > 0
        if (fromTables) return false
        const entry = catalog.find((c) => c.freightType === f)
        return entry?.tiers[t] != null
      })
      out[f] = dynamic.length > 0 ? dynamic : legacy
    }
    return out
  }, [rateTables, catalog])

  function lineAmounts(l: DraftLine): { unitPrice: number | null; total: number; profit: number } {
    const lbs = Number(l.quantityLbs) || 0
    const tp = tierPriceFromTables(rateTables, l.freightType, l.tier) ?? tierPriceFromCatalog(catalog, l.freightType, l.tier)
    if (!tp) return { unitPrice: null, total: 0, profit: 0 }
    const total = round2(lbs * tp.price)
    const profit = round2(total - lbs * tp.cost)
    return { unitPrice: tp.price, total, profit }
  }

  const totals = lines.reduce(
    (acc, l) => {
      const a = lineAmounts(l)
      return { total: round2(acc.total + a.total), profit: round2(acc.profit + a.profit) }
    },
    { total: 0, profit: 0 },
  )

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  async function submit() {
    setErr(null)
    if (!clientName.trim()) return setErr('El cliente es obligatorio.')
    const cleanLines = lines
      .map((l) => ({ freightType: l.freightType, tier: l.tier, quantityLbs: Number(l.quantityLbs), description: l.description || null }))
      .filter((l) => l.quantityLbs > 0)
    if (cleanLines.length === 0) return setErr('Agrega al menos una línea con peso.')
    // The server is authoritative: an unpriced tier fails there with a clear message.
    setSaving(true)
    try {
      const view = await billingApi.createInvoice({
        clientName: clientName.trim(),
        issueDate,
        observations: observations || null,
        lines: cleanLines,
        packageIds: prefill?.packageIds,
      })
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
              <input class={inputCls} value={clientName} onInput={(e) => setClientName((e.target as HTMLInputElement).value)} placeholder="Nombre del cliente" />
            </Field>
            <Field label="Fecha de emisión">
              <input type="date" class={inputCls} value={issueDate} onInput={(e) => setIssueDate((e.target as HTMLInputElement).value)} />
            </Field>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Líneas</div>
            {lines.map((l, i) => {
              const a = lineAmounts(l)
              return (
                <div key={i} class="grid grid-cols-12 items-end gap-2 rounded-lg border border-gray-100 p-2">
                  <label class="col-span-3 text-[11px] text-gray-500">
                    Flete
                    <select class={`${inputCls} mt-1 w-full`} value={l.freightType} onChange={(e) => setLine(i, { freightType: (e.target as HTMLSelectElement).value as FreightType })}>
                      {FREIGHTS.map((f) => <option key={f} value={f}>{FREIGHT_LABEL[f]}</option>)}
                    </select>
                  </label>
                  <label class="col-span-3 text-[11px] text-gray-500">
                    Tarifa
                    <select class={`${inputCls} mt-1 w-full`} value={l.tier} onChange={(e) => setLine(i, { tier: (e.target as HTMLSelectElement).value })}>
                      {(tiersByFreight[l.freightType].includes(l.tier) || tiersByFreight[l.freightType].length === 0
                        ? tiersByFreight[l.freightType]
                        : [l.tier, ...tiersByFreight[l.freightType]]
                      ).map((t) => <option key={t} value={t}>{TIER_LABEL[t] ?? t}</option>)}
                    </select>
                  </label>
                  <label class="col-span-2 text-[11px] text-gray-500">
                    Libras
                    <input type="number" min="0" step="0.01" class={`${inputCls} mt-1 w-full`} value={l.quantityLbs} onInput={(e) => setLine(i, { quantityLbs: (e.target as HTMLInputElement).value })} />
                  </label>
                  <div class="col-span-3 pb-2 text-right text-sm">
                    <div class="font-semibold text-secondary">{a.unitPrice == null ? 'N/A' : fmtUsd(a.total)}</div>
                    <div class="text-[11px] text-gray-400">{a.unitPrice == null ? 'tarifa no aplica' : `${fmtUsd(a.unitPrice)}/lb`}</div>
                  </div>
                  <button class="col-span-1 pb-2 text-gray-300 hover:text-red-500" aria-label="Quitar línea" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              )
            })}
            <Button variant="ghost" onClick={() => {
              const f = 'AIR'
              setLines((ls) => [...ls, { freightType: f, tier: tiersByFreight[f][0] ?? 'REGULAR', quantityLbs: '', description: '' }])
            }}>
              <Plus class="h-4 w-4" /> Agregar línea
            </Button>
          </div>

          <Field label="Observaciones">
            <textarea class={`${inputCls} min-h-[60px]`} value={observations} onInput={(e) => setObservations((e.target as HTMLTextAreaElement).value)} />
          </Field>

          <div class="flex items-center justify-between border-t border-gray-100 pt-3">
            <div class="text-sm">
              <span class="text-gray-500">Total </span>
              <span class="text-lg font-bold text-secondary">{fmtUsd(totals.total)}</span>
              <span class="ml-3 text-gray-500">Ganancia </span>
              <span class="font-semibold text-green-700">{fmtUsd(totals.profit)}</span>
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
