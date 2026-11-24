import { Check, Plus, Trash2, X } from 'lucide-preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { billingApi, type CatalogEntry, type CreateInvoiceInput, type FreightType, type InvoiceView, type PriceTier, type UnbilledPackage } from '../../lib/billing'
import { configApi, type ChargeConcept, type RateCardInfo } from '../../lib/config'
import { customerApi, type Customer } from '../../lib/customer'
import { FREIGHT_LABEL, fmtMoney, TIER_LABEL } from '../../lib/format'
import { AlertDialog, Button, Card, ConfirmDialog, Field, inputCls, SectionTitle, Spinner, Tooltip } from '../ui'
import ClientSearch from '../ui/ClientSearch'
import ChargeSummary from './ChargeSummary'

interface DraftLine {
  freightType: FreightType
  tier: PriceTier
  quantityLbs: string
  description: string
  /** Explicit rate table (overrides the client's default). null = client default. */
  rateTableId: string | null
  /** Display-only: package guide + tracking this line bills (resolved from prefill or linked packages). */
  guia: string | null
  tracking: string | null
  /** Package billed by this line (drives the guided flow + server link sync). */
  packageId: string | null
  /** Billing kind of the line: fixed lines never re-quote by weight. */
  pricingKind: 'weight' | 'fixed'
  /** Fixed package: the stored charge the Worker bills (never recomputed here). */
  fixedCharge?: number | null
  /** Fixed package: its utilidad, when the API exposes it (finance roles only). */
  fixedProfit?: number | null
}

/** Prefill lines may carry display-only guia/tracking/packageId beyond the create shape. */
interface PrefillLine {
  freightType: FreightType
  tier: PriceTier
  quantityLbs: number
  description?: string | null
  rateTableId?: string | null
  guia?: string | null
  tracking?: string | null
  packageId?: string | null
  /** Fixed service: the package's stored charge + utilidad. */
  pricingKind?: 'weight' | 'fixed'
  customerCharge?: number | null
  customerProfit?: number | null
}
interface InvoicePrefill extends Omit<Partial<CreateInvoiceInput>, 'lines'> { clientId?: string | null; lines?: PrefillLine[] }

interface DraftOther {
  conceptId: string
  extra: string
  amount: string
}

const FREIGHTS: FreightType[] = ['AIR', 'MAR']
// Legacy catalog tiers — fallback when the agency has no rate tables yet.
const LEGACY_TIERS: PriceTier[] = ['REGULAR', 'ESPECIAL', 'VIP', 'MADRES', 'DARIO']

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Invoice editor modal — used for both create and edit (DRAFT) flows.
 *  When `invoiceId` is provided, loads the existing invoice and submits via PATCH.
 *  Otherwise creates a new invoice via POST. */
export default function InvoiceForm({
  prefill,
  invoiceId,
  onClose,
  onCreated,
}: {
  prefill?: InvoicePrefill
  invoiceId?: string
  onClose: () => void
  onCreated: (v: InvoiceView) => void
}) {
  const isEdit = !!invoiceId
  const [rateCards, setRateCards] = useState<RateCardInfo[]>([])
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [concepts, setConcepts] = useState<ChargeConcept[]>([])
  const [clientName, setClientName] = useState(prefill?.clientName ?? '')
  const [clientId, setClientId] = useState<string | null>(prefill?.clientId ?? null)
  // Client's default rate table — preselects compatible freight lines (server stays the pricing authority).
  const [clientDefaultRate, setClientDefaultRate] = useState<string | null>(null)
  const [clientPkgs, setClientPkgs] = useState<UnbilledPackage[]>([])
  const [pkgLoading, setPkgLoading] = useState(false)
  const [pkgErr, setPkgErr] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>(prefill?.lines?.map((l) => l.packageId).filter((id): id is string => !!id) ?? [])
  const [issueDate, setIssueDate] = useState(prefill?.issueDate ?? new Date().toISOString().slice(0, 10))
  const [observations, setObservations] = useState('')
  const [currency, setCurrency] = useState<'USD' | 'NIO'>('USD')
  const [lines, setLines] = useState<DraftLine[]>(
    prefill?.lines?.map((l) => {
      const isFixed = l.pricingKind === 'fixed' || l.customerCharge != null
      return {
        freightType: l.freightType,
        tier: isFixed ? 'FIXED' : l.tier,
        // One guía = one unit for fixed services; weight lines bill pounds.
        quantityLbs: isFixed ? '1' : String(l.quantityLbs),
        description: l.description ?? '',
        rateTableId: l.rateTableId ?? null,
        guia: l.guia ?? null,
        tracking: l.tracking ?? null,
        packageId: l.packageId ?? null,
        pricingKind: isFixed ? 'fixed' : 'weight',
        fixedCharge: isFixed ? l.customerCharge ?? null : null,
        fixedProfit: isFixed ? l.customerProfit ?? null : null,
      }
    }) ?? [
      { freightType: 'AIR', tier: 'REGULAR', quantityLbs: '', description: '', rateTableId: null, guia: null, tracking: null, packageId: null, pricingKind: 'weight' },
    ],
  )
  const [others, setOthers] = useState<DraftOther[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** Rules that stop the flow (mixed billing kinds): loud, blocking alert. */
  const [blocking, setBlocking] = useState<{ title: string; message: string } | null>(null)
  /** Saving asks through the shared dialog (no window.confirm). */
  const [confirmSave, setConfirmSave] = useState(false)
  const [loadingInvoice, setLoadingInvoice] = useState(isEdit)

  useEffect(() => {
    configApi
      .listRateCards()
      .then(({ cards }) => setRateCards(cards))
      .catch(() => setRateCards([]))
    configApi
      .chargeConcepts()
      .then((cs) => setConcepts(cs.filter((c) => c.active)))
      .catch(() => setConcepts([]))
    configApi.info().then((p) => setCurrency(p.currency)).catch(() => {})
    billingApi.catalog().then(setCatalog).catch(() => setErr('No se pudo cargar el catálogo.'))
    // Load existing invoice for edit mode
    if (isEdit && invoiceId) {
      setLoadingInvoice(true)
      billingApi
        .getInvoice(invoiceId)
        .then((inv) => {
          setClientName(inv.clientName ?? '')
          setIssueDate(inv.issueDate ?? new Date().toISOString().slice(0, 10))
          setObservations(inv.observations ?? '')
          const freightLines = inv.lines.filter((l) => l.lineType === 'freight')
          const otherLines = inv.lines.filter((l) => l.lineType === 'other')
          setClientId(inv.clientId ?? null)
          setSelectedIds(freightLines.map((l) => l.packageId).filter((id): id is string => !!id))
          setLines(
            freightLines.map((l) => {
              let guia = l.packageGuia ?? null
              let tracking = l.packageTracking ?? null
              if (!guia && !tracking) {
                const pkg = l.packageId ? inv.packages.find((p) => p.packageId === l.packageId) : null
                if (pkg) {
                  guia = pkg.guia ?? null
                  tracking = pkg.tracking ?? null
                } else if (inv.packages.length === 1) {
                  guia = inv.packages[0].guia ?? null
                  tracking = inv.packages[0].tracking ?? null
                }
              }
              // A line priced from the package snapshot is a fixed service: keep
              // its stored charge/profit and its single unit so a save never
              // drops it (quantity_lbs is 0 for fixed lines by design).
              const isFixed = l.pricingSource === 'package_snapshot'
              return {
                freightType: (l.freightType ?? 'AIR') as FreightType,
                tier: isFixed ? 'FIXED' : ((l.priceTier ?? 'REGULAR') as PriceTier),
                quantityLbs: isFixed ? '1' : String(l.quantityLbs ?? ''),
                description: l.description ?? '',
                // Keep the card that priced the line; the client's current
                // default only fills lines without one (hydrated above).
                rateTableId: l.rateCardId ?? null,
                guia,
                tracking,
                packageId: l.packageId ?? null,
                pricingKind: isFixed ? ('fixed' as const) : ('weight' as const),
                fixedCharge: isFixed ? l.total : null,
                fixedProfit: isFixed ? l.profit : null,
              }
            }),
          )
          setOthers(
            otherLines.map((l) => ({
              conceptId: '',
              extra: l.description ?? '',
              amount: String(l.total ?? ''),
            })),
          )
        })
        .catch((e) => setErr(e instanceof Error ? e.message : 'No se pudo cargar la factura.'))
        .finally(() => setLoadingInvoice(false))
    }
  }, [])

  // Guided flow: load the selected client's unbilled packages.
  useEffect(() => {
    if (!clientId) {
      setClientPkgs([])
      return
    }
    let alive = true
    setPkgLoading(true)
    setPkgErr(null)
    billingApi
      .unbilledPackages(clientId)
      .then((r) => alive && setClientPkgs(r.packages))
      .catch(() => alive && setPkgErr('No se pudieron cargar las guías del cliente.'))
      .finally(() => alive && setPkgLoading(false))
    return () => {
      alive = false
    }
  }, [clientId])

  // Hydrate the selected / prefilled / edited client: canonical name + assigned
  // rate card. The Worker prices freight with the client's default card, so the
  // preview AND the "Tarifa" select must use that same card, not the first org
  // card. A client picked in ClientSearch already carries its defaults, so only
  // ids that arrive without them (prefill, edit) are fetched.
  const defaultsFor = useRef<string | null>(null)
  useEffect(() => {
    if (!clientId || defaultsFor.current === clientId) return
    let alive = true
    customerApi
      .get(clientId)
      .then((c) => {
        if (!alive) return
        defaultsFor.current = clientId
        setClientName(c.name)
        setClientDefaultRate(c.defaultRateCardId ?? c.defaultRateId ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [clientId])

  // Make the client's card the visible tariff on every freight line that doesn't
  // carry one yet (guided lines, prefill, edit). Cards that don't price the
  // line's freight are skipped; the backend still resolves the final price.
  // Applied once per client card so an explicit "(tarifa del cliente)" choice
  // made afterwards is respected.
  const appliedDefaultFor = useRef<string | null>(null)
  useEffect(() => {
    if (!clientDefaultRate) {
      appliedDefaultFor.current = null
      return
    }
    const appliedKey = `${clientId ?? ''}:${clientDefaultRate}`
    if (appliedDefaultFor.current === appliedKey) return
    const card = rateCards.find((c) => c.id === clientDefaultRate)
    if (!card) return // cards still loading — retry when they arrive
    appliedDefaultFor.current = appliedKey
    setLines((ls) =>
      ls.map((l) => {
        if (l.rateTableId) return l
        const entry = card.currentVersion.entries.find((e) => e.serviceType === l.freightType)
        return entry ? { ...l, rateTableId: card.id, tier: entry.name as PriceTier } : l
      }),
    )
  }, [clientId, clientDefaultRate, rateCards])

  const activeConcepts = useMemo(() => concepts.filter((c) => c.active), [concepts])

  // Rate cards for a freight (each card prices AIR and MAR; the line picks by service).
  const tablesFor = (f: FreightType) => rateCards.filter((c) => c.currentVersion.entries.some((e) => e.serviceType === f))
  const tableLabel = (c: RateCardInfo) => c.name

  /** The client's default rate card when it offers the line's freight — preselects
   *  visually; the backend resolves the final price (server stays authoritative). */
  const clientDefaultFor = (f: FreightType): string | null => {
    if (!clientDefaultRate) return null
    const c = rateCards.find((x) => x.id === clientDefaultRate)
    return c && c.currentVersion.entries.some((e) => e.serviceType === f) ? c.id : null
  }

  /** Tiers available for a line: the chosen card's entry name for that service,
   *  legacy catalog fallback when the agency has no cards for that freight. */
  function tiersFor(freightType: FreightType, rateCardId: string | null): PriceTier[] {
    if (rateCardId) {
      const c = rateCards.find((x) => x.id === rateCardId)
      if (c) return c.currentVersion.entries.filter((e) => e.serviceType === freightType).map((e) => e.name)
    }
    if (rateCards.some((x) => x.currentVersion.entries.some((e) => e.serviceType === freightType))) return []
    const entry = catalog.find((c) => c.freightType === freightType)
    return entry ? LEGACY_TIERS.filter((t) => entry.tiers[t] != null) : []
  }

  /** Tier to start a line with: the card's own entry name when a card prices it
   *  (so the tier select isn't left blank), legacy catalog otherwise. */
  function tierFor(freightType: FreightType, rateCardId: string | null): PriceTier {
    const tiers = tiersFor(freightType, rateCardId)
    return tiers[0] ?? 'REGULAR'
  }

  function lineAmounts(l: DraftLine): { unitPrice: number | null; total: number; cost: number; profit: number | null } {
    // Fixed package: the package's stored charge is the amount; its cost/utilidad
    // come from the API (never estimated in the browser).
    if (l.pricingKind === 'fixed') {
      const charge = l.fixedCharge ?? null
      const profit = l.fixedProfit ?? null
      return {
        unitPrice: charge,
        total: charge ?? 0,
        cost: charge != null && profit != null ? round2(charge - profit) : 0,
        profit,
      }
    }
    const lbs = Number(l.quantityLbs) || 0
    // Mirror the Worker's resolution: explicit table, then the client's default
    // card when it prices this freight, then any org card. Only unmigrated orgs
    // (no cards) fall back to the legacy catalog preview.
    const hasFreight = (c: RateCardInfo) => c.currentVersion.entries.some((e) => e.serviceType === l.freightType)
    const explicit = l.rateTableId ? rateCards.find((c) => c.id === l.rateTableId) : undefined
    const clientDefault = clientDefaultRate ? rateCards.find((c) => c.id === clientDefaultRate) : undefined
    const card = explicit ?? (clientDefault && hasFreight(clientDefault) ? clientDefault : rateCards.find(hasFreight))
    if (card) {
      const entry = card.currentVersion.entries.find((e) => e.serviceType === l.freightType)
      if (!entry) return { unitPrice: null, total: 0, cost: 0, profit: null }
      const total = round2(lbs * entry.price)
      const cost = round2(lbs * entry.cost)
      return { unitPrice: entry.price, total, cost, profit: round2(total - cost) }
    }
    const entry = catalog.find((c) => c.freightType === l.freightType)
    const price = entry?.tiers[l.tier]
    if (price == null) return { unitPrice: null, total: 0, cost: 0, profit: null }
    const total = round2(lbs * price)
    const cost = round2(lbs * (entry?.cost ?? 0))
    return { unitPrice: price, total, cost, profit: round2(total - cost) }
  }

  function otherAmount(o: DraftOther): number {
    const concept = activeConcepts.find((c) => c.id === o.conceptId)
    return Number(o.amount) || concept?.suggestedPrice || 0
  }

  const totals = useMemo(() => {
    let total = 0
    let profit = 0
    let cost = 0
    // A single unknown fixed utilidad must not be shown as 0 — the footer says "—".
    let profitComplete = true
    for (const l of lines) {
      const a = lineAmounts(l)
      total += a.total
      cost += a.cost
      if (a.profit == null) profitComplete = false
      else profit += a.profit
    }
    for (const o of others) {
      const amount = otherAmount(o)
      total += amount
      profit += amount
    }
    return { total: round2(total), cost: round2(cost), profit: round2(profit), profitComplete }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, others, rateCards, catalog, activeConcepts])

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  function addFreightLine() {
    const tableId = clientDefaultFor('AIR')
    setLines((ls) => [...ls, { freightType: 'AIR', tier: tierFor('AIR', tableId), quantityLbs: '', description: '', rateTableId: tableId, guia: null, tracking: null, packageId: null, pricingKind: 'weight' }])
  }

  /** Guided flow: select/deselect a package → one freight line per selected package. */
  function togglePackage(pkg: UnbilledPackage) {
    const has = selectedIds.includes(pkg.packageId)
    setSelectedIds((ids) => (has ? ids.filter((id) => id !== pkg.packageId) : [...ids, pkg.packageId]))
    setLines((ls) => {
      if (has) return ls.filter((l) => l.packageId !== pkg.packageId)
      if (ls.some((l) => l.packageId === pkg.packageId)) return ls
      const freightType = pkg.freightType ?? (pkg.serviceType === 'maritimo' ? 'MAR' : 'AIR')
      const tableId = clientDefaultFor(freightType)
      const isFixed = pkg.pricingKind === 'fixed' && pkg.customerCharge != null
      return [
        ...ls,
        {
          freightType,
          tier: isFixed ? 'FIXED' as PriceTier : tierFor(freightType, tableId),
          // Fixed: one guía = one unit — the stored snapshot is the only input.
          quantityLbs: isFixed ? '1' : String(pkg.weightLb ?? ''),
          description: '',
          rateTableId: isFixed ? null : tableId,
          guia: pkg.guia,
          tracking: pkg.tracking,
          packageId: pkg.packageId,
          pricingKind: isFixed ? 'fixed' : 'weight',
          fixedCharge: isFixed ? pkg.customerCharge : null,
          fixedProfit: isFixed ? pkg.grossProfit ?? null : null,
        },
      ]
    })
  }

  function addOtherLine() {
    const concept = activeConcepts[0]
    setOthers((os) => [...os, { conceptId: concept?.id ?? '', extra: '', amount: concept?.suggestedPrice != null ? String(concept.suggestedPrice) : '' }])
  }

  /** Validate first, then ask through the shared dialog. */
  function submit() {
    if (!validateBeforeSave()) return
    setConfirmSave(true)
  }

  function validateBeforeSave(): boolean {
    setErr(null)
    // One invoice bills one pricing kind: catch it before the request so the
    // operator sees why, instead of a server round-trip.
    const kinds = new Set(lines.map((l) => l.pricingKind))
    if (kinds.size > 1) {
      setBlocking({
        title: 'No se pueden mezclar tipos de tarifa',
        message:
          'Esta factura tiene paquetes por peso y paquetes de cuota fija. Generá una factura por tipo de servicio: así el cobro de cada guía queda claro y el cierre no se traba.',
      })
      return false
    }
    if (!clientName.trim()) {
      setErr('El cliente es obligatorio.')
      return false
    }
    const guidedCreate = !isEdit && !prefill?.packageIds?.length
    if (guidedCreate && !clientId) {
      setErr('Selecciona un cliente para cargar sus guías.')
      return false
    }
    if (guidedCreate && selectedIds.length === 0) {
      setErr('Selecciona al menos una guía del cliente.')
      return false
    }
    const validLines = lines.filter((l) => l.pricingKind === 'fixed' || Number(l.quantityLbs) > 0)
    if (validLines.length === 0) {
      setErr('Agregá al menos una línea con cantidad.')
      return false
    }
    return true
  }

  async function doSubmit() {
    if (!validateBeforeSave()) return
    const cleanLines = lines
      .filter((l) => l.pricingKind === 'fixed' || Number(l.quantityLbs) > 0)
      .map((l) => ({
        freightType: l.freightType,
        // Fixed lines keep the sentinel tier: the Worker prices them from the
        // package snapshot and never re-quotes by weight.
        tier: l.pricingKind === 'fixed' ? 'FIXED' : l.tier,
        quantityLbs: l.pricingKind === 'fixed' ? 1 : Number(l.quantityLbs),
        description: l.description || null,
        rateTableId: l.rateTableId,
        packageId: l.packageId ?? null,
      }))
    const cleanOthers = others
      .map((o) => ({ conceptId: o.conceptId || null, description: o.extra || null, amount: otherAmount(o) }))
      .filter((o) => o.amount > 0)

    setSaving(true)
    try {
      let view: InvoiceView
      if (isEdit && invoiceId) {
        view = await billingApi.updateInvoice(invoiceId, {
          issueDate,
          observations: observations || null,
          lines: cleanLines,
          otherLines: cleanOthers,
        })
      } else {
        view = await billingApi.createInvoice({
          clientName: clientName.trim(),
          // Empty string = client typed inline (allowCreate) → let the server resolve by name.
          clientId: clientId || undefined,
          issueDate,
          observations: observations || null,
          lines: cleanLines,
          otherLines: cleanOthers,
          packageIds: selectedIds.length ? selectedIds : prefill?.packageIds,
          status: 'DRAFT',
        })
      }
      onCreated(view)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar la factura.'
      if (/mezclar paquetes/i.test(msg)) {
        setBlocking({ title: 'No se pueden mezclar tipos de tarifa', message: msg })
      } else {
        setErr(msg)
      }
    } finally {
      setSaving(false)
      setConfirmSave(false)
    }
  }

  return (
    <div class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:hidden">
      <Card class="my-8 w-full max-w-2xl">
        <SectionTitle class="justify-between">
          <span>{isEdit ? 'Editar factura' : 'Nueva factura'}</span>
          <Tooltip text="Cerrar formulario">
            <button onClick={onClose} aria-label="Cerrar formulario de factura" class="text-gray-400 hover:text-gray-700">
              <X class="h-4 w-4" />
            </button>
          </Tooltip>
        </SectionTitle>
        {loadingInvoice ? (
          <div class="p-6"><Spinner label="Cargando factura…" /></div>
        ) : (
        <div class="space-y-4 p-5">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cliente">
              <ClientSearch
                value={clientName}
                onSelect={(c: Customer) => {
                  setClientName(c.name)
                  if (!isEdit) {
                    setClientId(c.id)
                    defaultsFor.current = c.id
                    setClientDefaultRate(c.defaultRateCardId ?? c.defaultRateId ?? null)
                    setSelectedIds([])
                    setLines([])
                  }
                }}
                onClear={() => setClientName('')}
                allowCreate
                placeholder="Nombre del cliente"
              />
            </Field>
            <Field label="Fecha de emisión">
              <input type="date" class={inputCls} value={issueDate} onInput={(e) => setIssueDate((e.target as HTMLInputElement).value)} />
            </Field>
          </div>

          {clientId && (
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Guías del cliente</div>
                {pkgLoading && <Spinner />}
                {pkgErr && <span class="text-xs text-red-600">{pkgErr}</span>}
              </div>
              {!pkgLoading && clientPkgs.length === 0 && <div class="text-xs text-gray-400">Sin paquetes pendientes para este cliente.</div>}
              <div class="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-2">
                {clientPkgs.map((p) => {
                  const checked = selectedIds.includes(p.packageId)
                  // Already on this invoice (checked) is selectable/deselectable
                  // even when the listing marks it "Ya facturado".
                  const blocked = !p.eligible && !checked
                  return (
                    <button
                      key={p.packageId}
                      type="button"
                      disabled={blocked}
                      onClick={() => !blocked && togglePackage(p)}
                      class={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${blocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50'}`}
                    >
                      <span class={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'}`} aria-hidden="true">
                        {checked && <Check class="h-3 w-3" />}
                      </span>
                      <span class="font-semibold text-gray-700">{p.guia ?? p.packageId.slice(0, 8)}</span>
                      {p.tracking && <span class="font-mono text-gray-400">{p.tracking}</span>}
                      {p.pricingKind === 'fixed' && p.customerCharge != null ? (
                        <span class="text-emerald-600">Cuota fija ${p.customerCharge.toFixed(2)}</span>
                      ) : (
                        p.weightLb != null && <span class="text-gray-400">{p.weightLb} lb</span>
                      )}
                      {blocked && <span class="ml-auto text-gray-400">{p.reason}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div class="space-y-2">
            <div class="text-xs font-semibold uppercase tracking-wide text-gray-500">Líneas de flete</div>
            {lines.map((l, i) => {
              const a = lineAmounts(l)
              const isFixed = l.pricingKind === 'fixed'
              // The tier ("categoría") only matters for legacy rate tables: a rate
              // card already fixes one price per service, so the selector was noise
              // (and English) on every card-priced line.
              const tiers = isFixed || l.rateTableId || rateCards.length > 0 ? [] : tiersFor(l.freightType, l.rateTableId)
              const tables = tablesFor(l.freightType)
              return (
                <div key={i} class="rounded-lg border border-gray-100 p-2">
                  {(l.guia || l.tracking) && (
                    <div class="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                      {l.guia && <span class="font-semibold text-gray-700">Guía {l.guia}</span>}
                      {l.tracking && <span class="font-mono text-gray-500">Tracking {l.tracking}</span>}
                      {isFixed && (
                        <span class="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">Cuota fija</span>
                      )}
                    </div>
                  )}
                  <div class="grid grid-cols-12 items-end gap-2">
                    <label class="col-span-3 text-[11px] text-gray-500">
                      Flete
                      {isFixed ? (
                        <div class="mt-1 rounded-lg bg-gray-50 px-2 py-2 text-sm text-gray-700">{FREIGHT_LABEL[l.freightType]}</div>
                      ) : (
                        <select class={`${inputCls} mt-1 w-full`} value={l.freightType} onChange={(e) => {
                          const f = (e.target as HTMLSelectElement).value as FreightType
                          const tableId = clientDefaultFor(f)
                          setLine(i, { freightType: f, rateTableId: tableId, tier: tiersFor(f, tableId)[0] ?? 'REGULAR' })
                        }}>
                          {FREIGHTS.map((f) => <option key={f} value={f}>{FREIGHT_LABEL[f]}</option>)}
                        </select>
                      )}
                    </label>
                    <label class="col-span-4 text-[11px] text-gray-500">
                      Tarifa
                      {isFixed ? (
                        <div class="mt-1 rounded-lg bg-gray-50 px-2 py-2 text-sm text-gray-700" title="La cuota fija del paquete se definió al crearlo">
                          Definida en el paquete
                        </div>
                      ) : (
                        <select class={`${inputCls} mt-1 w-full`} value={l.rateTableId ?? ''} onChange={(e) => {
                          const id = (e.target as HTMLSelectElement).value || null
                          const card = id ? rateCards.find((c) => c.id === id) : null
                          setLine(i, { rateTableId: id, tier: card?.currentVersion.entries.find((en) => en.serviceType === l.freightType)?.name ?? 'REGULAR' })
                        }}>
                          <option value="">(tarifa del cliente)</option>
                          {tables.map((t) => <option key={t.id} value={t.id}>{tableLabel(t)}</option>)}
                        </select>
                      )}
                    </label>
                    <label class="col-span-2 text-[11px] text-gray-500">
                      {isFixed ? 'Unidades' : 'Libras'}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        class={`${inputCls} mt-1 w-full disabled:bg-gray-50 disabled:text-gray-500`}
                        value={isFixed ? '1' : l.quantityLbs}
                        disabled={isFixed}
                        title={isFixed ? 'Una guía = una unidad en cuota fija' : undefined}
                        onInput={(e) => setLine(i, { quantityLbs: (e.target as HTMLInputElement).value })}
                      />
                    </label>
                    <div class="col-span-2 pb-2 text-right text-sm">
                      <div class="font-semibold text-secondary">
                        {isFixed ? (a.total > 0 ? fmtMoney(a.total, currency) : '…') : a.unitPrice == null ? 'N/A' : fmtMoney(a.total, currency)}
                      </div>
                      <div class="text-[11px] text-gray-400">
                        {isFixed
                          ? 'por unidad'
                          : a.unitPrice == null
                            ? 'tarifa no aplica'
                            : `${fmtMoney(a.unitPrice, currency)}/lb`}
                      </div>
                    </div>
                    <button class="col-span-1 pb-2 text-gray-300 hover:text-red-500" aria-label={`Quitar línea ${i + 1}`} title={`Quitar línea ${i + 1}`} onClick={() => {
                          setLines((ls) => ls.filter((_, idx) => idx !== i))
                          if (l.packageId) setSelectedIds((ids) => ids.filter((id) => id !== l.packageId))
                        }}>
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                  {tiers.length > 0 && (
                    <div class="mt-2 flex items-center gap-2">
                      <span class="text-[11px] text-gray-400">Categoría de precio:</span>
                      <select class={`${inputCls} w-auto text-xs`} value={tiers.includes(l.tier) ? l.tier : tiers[0]} onChange={(e) => setLine(i, { tier: (e.target as HTMLSelectElement).value })}>
                        {tiers.map((t) => <option key={t} value={t}>{TIER_LABEL[t] ?? t}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
            <Button variant="ghost" onClick={addFreightLine} disabled={!!clientId && !isEdit}>
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
                    <button class="col-span-2 pb-2 text-gray-300 hover:text-red-500" aria-label={`Quitar cargo ${i + 1}`} title={`Quitar cargo ${i + 1}`} onClick={() => setOthers((os) => os.filter((_, idx) => idx !== i))}>
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

          <div class="space-y-2 border-t border-gray-100 pt-3">
            <ChargeSummary
              title="Resumen de cobro"
              customerCharge={totals.total}
              currency={currency}
              providerCost={totals.cost}
              profit={totals.profitComplete ? totals.profit : null}
              canSeeCosts
              note="El sistema recalcula y guarda los montos al crear o guardar la factura."
            />
            <div class="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={submit} disabled={saving}>{saving ? <Spinner /> : isEdit ? 'Guardar cambios' : 'Crear factura'}</Button>
            </div>
          </div>
          {err && <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        </div>
        )}
      </Card>

      <AlertDialog open={blocking !== null} onClose={() => setBlocking(null)} title={blocking?.title ?? ''}>
        {blocking?.message}
      </AlertDialog>

      <ConfirmDialog
        open={confirmSave}
        onClose={() => !saving && setConfirmSave(false)}
        onConfirm={() => void doSubmit()}
        variant="warning"
        title={isEdit ? '¿Guardar los cambios de la factura?' : '¿Generar la factura?'}
        confirmLabel={isEdit ? 'Guardar cambios' : 'Crear factura'}
        loading={saving}
        message={
          isEdit
            ? 'Se actualizarán las líneas y montos de esta factura.'
            : 'Se creará como borrador editable. Después podrás revisarla, enlazar las guías y cerrarla.'
        }
      />
    </div>
  )
}
