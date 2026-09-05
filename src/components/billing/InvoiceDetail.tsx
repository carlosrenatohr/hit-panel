import { Ban, Check, Copy, Link2, Package, Printer, Share2, Trash2, X } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import {
  billingApi,
  type ApplyPaymentInput,
  type Currency,
  type InvoiceView,
  type PaymentBank,
  type PaymentMethod,
} from '../../lib/billing'
import { FREIGHT_LABEL, fmtDate, fmtUsd, INVOICE_STATUS_LABEL, INVOICE_STATUS_SOFT, TIER_LABEL } from '../../lib/format'
import { configApi, type AgencyInfo } from '../../lib/config'
import { Button, Card, Field, inputCls, Spinner } from '../ui'
import { InvoiceDaysBadge } from './badges'
import InvoicePrint, { type InvoiceBrand } from './InvoicePrint'

function StatusPill({ s }: { s: string }) {
  return <span class={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_SOFT[s] ?? 'bg-gray-100 text-gray-600'}`}>{INVOICE_STATUS_LABEL[s] ?? s}</span>
}

const METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CASH', 'CREDIT_BALANCE']
const METHOD_LABEL: Record<PaymentMethod, string> = { BANK_TRANSFER: 'Transferencia', CASH: 'Efectivo', CREDIT_BALANCE: 'Saldo a favor' }
const BANKS: PaymentBank[] = ['BAC', 'LAFISE', 'BANPRO']

export default function InvoiceDetail({
  id,
  canWrite,
  onClose,
  onChanged,
}: {
  id: string
  canWrite: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const [inv, setInv] = useState<InvoiceView | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Payment form
  const [pm, setPm] = useState<PaymentMethod>('BANK_TRANSFER')
  const [bank, setBank] = useState<PaymentBank>('BAC')
  const [cur, setCur] = useState<Currency>('USD')
  const [amount, setAmount] = useState('')
  const [fx, setFx] = useState('')
  const [guia, setGuia] = useState('')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [brand, setBrand] = useState<InvoiceBrand | null>(null)

  // Issuing agency's brand for the printable receipt (cosmetic — never blocks).
  useEffect(() => {
    let alive = true
    configApi
      .branding()
      .then(({ agencies }) => {
        if (!alive) return
        const a: AgencyInfo | undefined = agencies[0]
        if (a) setBrand({ name: a.name, logoUrl: a.logoUrl })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      setInv(await billingApi.getInvoice(id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar la factura.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [id])

  async function run(fn: () => Promise<InvoiceView>) {
    setBusy(true)
    setErr(null)
    try {
      setInv(await fn())
      onChanged?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'La acción falló.')
    } finally {
      setBusy(false)
    }
  }

  function addPayment() {
    const amt = Number(amount)
    if (!(amt > 0)) return setErr('Monto inválido.')
    const input: ApplyPaymentInput = {
      method: pm,
      bank: pm === 'BANK_TRANSFER' ? bank : null,
      currency: cur,
      amount: amt,
      fxRate: cur === 'NIO' && fx ? Number(fx) : null,
    }
    void run(() => billingApi.applyPayment(id, input)).then(() => {
      setAmount('')
      setFx('')
    })
  }

  return (
    <div class="fixed inset-0 z-40 flex justify-end bg-black/40 print:static print:bg-transparent" onClick={onClose}>
      <div class="flex h-full w-full max-w-lg flex-col bg-neutral-bg shadow-xl print:hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div class="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <div class="flex items-center gap-3">
            <span class="text-lg font-bold text-secondary">Factura #{inv?.invoiceNumber ?? '…'}</span>
            {inv && <StatusPill s={inv.status} />}
          </div>
          <div class="flex items-center gap-1">
            {inv && canWrite && (
              <button
                aria-label="Compartir link público"
                title="Compartir link público"
                onClick={async () => {
                  try {
                    const { url } = await billingApi.shareInvoice(id)
                    setShareUrl(url)
                    navigator.clipboard?.writeText(url)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : 'No se pudo generar el link.')
                  }
                }}
                class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <Share2 class="h-4 w-4" />
              </button>
            )}
            {inv && (
              <button aria-label="Imprimir" title="Imprimir" onClick={() => window.print()} class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <Printer class="h-4 w-4" />
              </button>
            )}
            <button aria-label="Cerrar" onClick={onClose} class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto p-5">
          {loading && <Spinner label="Cargando factura…" />}
          {err && <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          {inv && (
            <>
              {/* Summary */}
              <Card class="p-4">
                <div class="mb-2 text-sm font-medium text-gray-700">{inv.clientName ?? '—'}</div>
                <div class="flex items-center gap-1.5 text-xs text-gray-500">
                  {fmtDate(inv.issueDate)} · año fiscal {inv.fiscalYear}
                  <InvoiceDaysBadge issueDate={inv.issueDate} paidAt={inv.paidAt} status={inv.status} />
                </div>
                {inv.status === 'PAID' && inv.paidAt && <div class="text-[11px] text-gray-400">Pagada el {fmtDate(inv.paidAt)}</div>}
                <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span class="text-gray-400">Total</span><div class="text-lg font-bold text-secondary">{fmtUsd(inv.total)}</div></div>
                  <div><span class="text-gray-400">Ganancia</span><div class="font-semibold text-green-700">{fmtUsd(inv.profit)}{inv.margin != null && <span class="ml-1 text-xs text-gray-400">({Math.round(inv.margin * 100)}%)</span>}</div></div>
                  <div><span class="text-gray-400">Pagado</span><div class="font-medium">{fmtUsd(inv.paidUsd)}</div></div>
                  <div><span class="text-gray-400">Saldo</span><div class="font-medium">{fmtUsd(inv.outstanding)}</div></div>
                </div>
              </Card>

              {shareUrl && (
                <Card class="flex items-center gap-2 p-3">
                  {copied ? <Check class="h-4 w-4 shrink-0 text-green-600" /> : <Copy class="h-4 w-4 shrink-0 text-gray-400" />}
                  <input readOnly value={shareUrl} class="flex-1 truncate bg-transparent text-xs text-gray-600 outline-none" onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <button class="text-xs font-medium text-primary" onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>Copiar</button>
                </Card>
              )}

              {/* Lines */}
              <Card>
                <div class="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Líneas</div>
                <table class="w-full text-left text-sm">
                  <tbody>
                    {inv.lines.map((l) => (
                      <tr key={l.lineNo} class="border-b border-gray-50 last:border-0">
                        <td class="px-4 py-2">
                          <div>{l.description ?? FREIGHT_LABEL[l.freightType]}</div>
                          <div class="text-[11px] text-gray-400">{FREIGHT_LABEL[l.freightType]} · {l.priceTier ? (TIER_LABEL[l.priceTier] ?? l.priceTier) : 'fuera de catálogo'} · {l.quantityLbs} lb</div>
                        </td>
                        <td class="px-4 py-2 text-right font-medium">{fmtUsd(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Payments */}
              <Card>
                <div class="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pagos</div>
                <div class="divide-y divide-gray-50">
                  {inv.payments.length === 0 && <div class="px-4 py-3 text-sm text-gray-400">Sin pagos registrados.</div>}
                  {inv.payments.map((p, i) => (
                    <div key={i} class="flex items-center justify-between px-4 py-2 text-sm">
                      <div>
                        <span class="font-medium">{p.method ?? p.raw ?? '—'}</span>
                        {p.bank && <span class="text-gray-400"> · {p.bank}</span>}
                        {p.quarantined && <span class="ml-1 rounded bg-yellow-50 px-1 text-[10px] text-yellow-700">revisar</span>}
                        <div class="text-[11px] text-gray-400">{fmtDate(p.paidAt)}{p.currency ? ` · ${p.currency}` : ''}</div>
                      </div>
                      <div class="text-right">{p.amountUsd != null ? fmtUsd(p.amountUsd) : '—'}</div>
                    </div>
                  ))}
                </div>
                {canWrite && inv.status !== 'VOID' && (
                  <div class="space-y-2 border-t border-gray-100 bg-gray-50/60 p-3">
                    <div class="grid grid-cols-2 gap-2">
                      <Field label="Método">
                        <select class={inputCls} value={pm} onChange={(e) => setPm((e.target as HTMLSelectElement).value as PaymentMethod)}>
                          {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                        </select>
                      </Field>
                      <Field label="Moneda">
                        <select class={inputCls} value={cur} onChange={(e) => setCur((e.target as HTMLSelectElement).value as Currency)}>
                          <option value="USD">USD</option>
                          <option value="NIO">NIO (córdobas)</option>
                        </select>
                      </Field>
                      {pm === 'BANK_TRANSFER' && (
                        <Field label="Banco">
                          <select class={inputCls} value={bank} onChange={(e) => setBank((e.target as HTMLSelectElement).value as PaymentBank)}>
                            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </Field>
                      )}
                      <Field label={cur === 'NIO' ? 'Monto (NIO)' : 'Monto (USD)'}>
                        <input type="number" min="0" step="0.01" class={inputCls} value={amount} onInput={(e) => setAmount((e.target as HTMLInputElement).value)} />
                      </Field>
                      {cur === 'NIO' && (
                        <Field label="Tasa (NIO por USD)">
                          <input type="number" min="0" step="0.01" class={inputCls} value={fx} onInput={(e) => setFx((e.target as HTMLInputElement).value)} placeholder="36.5" />
                        </Field>
                      )}
                    </div>
                    <Button onClick={addPayment} disabled={busy}>Registrar pago</Button>
                  </div>
                )}
              </Card>

              {/* Linked packages */}
              <Card>
                <div class="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Paquetes enlazados</div>
                <div class="divide-y divide-gray-50">
                  {inv.packages.length === 0 && <div class="px-4 py-3 text-sm text-gray-400">Sin paquetes enlazados.</div>}
                  {inv.packages.map((p) => (
                    <div key={p.packageId} class="flex items-center justify-between px-4 py-2 text-sm">
                      <span class="flex items-center gap-2"><Package class="h-3.5 w-3.5 text-gray-400" /> {p.matchedOc ?? p.packageId.slice(0, 8)} <span class="text-[10px] text-gray-400">({p.source})</span></span>
                      {canWrite && (
                        <button aria-label="Desenlazar" onClick={() => run(() => billingApi.unlinkPackage(id, p.packageId))} class="text-gray-300 hover:text-red-500">
                          <Trash2 class="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {canWrite && (
                  <div class="flex items-end gap-2 border-t border-gray-100 p-3">
                    <div class="flex-1">
                      <Field label="Enlazar por guía">
                        <input class={inputCls} value={guia} onInput={(e) => setGuia((e.target as HTMLInputElement).value)} placeholder="N.º de guía / almacén" />
                      </Field>
                    </div>
                    <Button variant="ghost" disabled={busy || !guia.trim()} onClick={() => run(() => billingApi.linkPackage(id, { guia: guia.trim() })).then(() => setGuia(''))}>
                      <Link2 class="h-4 w-4" /> Enlazar
                    </Button>
                  </div>
                )}
              </Card>

              {inv.observations && <div class="rounded-lg bg-white p-3 text-sm text-gray-600 ring-1 ring-gray-100">{inv.observations}</div>}

              {canWrite && inv.status !== 'VOID' && (
                <Button variant="danger" disabled={busy} onClick={() => { if (confirm('¿Anular esta factura? No se puede deshacer.')) void run(() => billingApi.voidInvoice(id, 'Anulada desde el panel')) }}>
                  <Ban class="h-4 w-4" /> Anular factura
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Print-only rendering (isolated by .invoice-print in global.css). */}
      {inv && <InvoicePrint inv={inv} brand={brand ?? undefined} />}
    </div>
  )
}
