import { AlertTriangle, Ban, Check, Link2, Lock, Package, Printer, ShieldAlert, Trash2, X } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import {
  billingApi,
  type ApplyPaymentInput,
  type Currency,
  type InvoiceView,
  type PaymentBank,
  type PaymentMethod,
} from '../../lib/billing'
import { fmtDateTime, fmtMoney, FREIGHT_LABEL, fmtDate, altCurrencyTotal, waPhone, INVOICE_STATUS_LABEL, INVOICE_STATUS_SOFT, TIER_LABEL } from '../../lib/format'
import { customerApi } from '../../lib/customer'
import { configApi, type AgencyInfo, type AgencyProfile, type PaymentCatalogs } from '../../lib/config'
import { Button, Card, ConfirmDialog, Field, inputCls, Modal, Spinner, Tooltip } from '../ui'
import { InvoiceDaysBadge } from './badges'
import InvoicePrint, { type InvoiceBrand } from './InvoicePrint'

/** WhatsApp brand glyph (lucide has no brand icons) — the share action is WhatsApp-only. */
function WhatsAppIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" class={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

function StatusPill({ s }: { s: string }) {
  return <span class={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${INVOICE_STATUS_SOFT[s] ?? 'bg-gray-100 text-gray-600'}`}>{INVOICE_STATUS_LABEL[s] ?? s}</span>
}

// Legacy payments stored enum codes; dynamic catalogs store display names.
const METHOD_LABEL: Record<string, string> = { BANK_TRANSFER: 'Transferencia', CASH: 'Efectivo', CREDIT_BALANCE: 'Saldo a favor' }
const FALLBACK_METHODS = ['Transferencia', 'Efectivo', 'Saldo a favor']
const FALLBACK_BANKS = ['BAC', 'LAFISE', 'BANPRO']

/** Money rounding for the payment preview (the Worker re-computes server-side). */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

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
  const [pm, setPm] = useState<PaymentMethod>('')
  const [bank, setBank] = useState<PaymentBank>('')
  const [reference, setReference] = useState('')
  const [comments, setComments] = useState('')
  const [cur, setCur] = useState<Currency>('USD')
  const [amount, setAmount] = useState('')
  const [fx, setFx] = useState('')
  const [guia, setGuia] = useState('')
  const [copied, setCopied] = useState(false)
  /** Payment review modal: nothing is posted until the operator confirms. */
  const [payConfirmOpen, setPayConfirmOpen] = useState(false)
  /** Close/void ask through the shared dialog (no browser confirm). */
  const [pendingAction, setPendingAction] = useState<'close' | 'void' | null>(null)
  const [brand, setBrand] = useState<InvoiceBrand | null>(null)
  const [catalogs, setCatalogs] = useState<PaymentCatalogs | null>(null)
  const [profile, setProfile] = useState<AgencyProfile | null>(null)
  const [events, setEvents] = useState<Array<{ action: string; detail: string | null; actor: string | null; createdAt: string }>>([])

  // Issuing agency's brand for the printable receipt (cosmetic — never blocks).
  useEffect(() => {
    let alive = true
    configApi
      .branding()
      .then(({ agencies }) => {
        if (!alive) return
        const a: AgencyInfo | undefined = agencies[0]
        if (a) setBrand({ name: a.name, logoUrl: a.logoUrl ? `${a.logoUrl}?v=${encodeURIComponent(a.updatedAt)}` : null })
      })
      .catch(() => {})
    configApi
      .info()
      .then((p) => alive && setProfile(p))
      .catch(() => {})
    configApi
      .paymentCatalogs()
      .then((c) => alive && setCatalogs(c))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Dynamic catalogs (agency-managed); fall back to the classic lists when empty —
  // an empty catalog never bricks the payment form (the Worker accepts free text then).
  const methods = catalogs?.methods.filter((m) => m.active).map((m) => m.name).length
    ? catalogs!.methods.filter((m) => m.active).map((m) => m.name)
    : FALLBACK_METHODS
  const banks = catalogs?.banks.filter((b) => b.active).map((b) => b.name).length
    ? catalogs!.banks.filter((b) => b.active).map((b) => b.name)
    : FALLBACK_BANKS

  // Preselect the first active entries once the catalogs arrive (or on fallback).
  useEffect(() => {
    setPm((v) => (methods.includes(v) ? v : methods[0] ?? ''))
    setBank((v) => (banks.includes(v) ? v : ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogs])

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      setInv(await billingApi.getInvoice(id))
      billingApi
        .invoiceEvents(id)
        .then((r) => setEvents(r.events))
        .catch(() => setEvents([]))
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

  /**
   * Share the invoice through WhatsApp without storing anything: reuses the
   * public receipt token and opens a wa.me deep link. Targets the client's
   * phone, falling back to the agency owner's registered number; both are
   * normalized to wa.me digits (country code, no separators).
   */
  async function shareToWhatsApp() {
    if (!inv) return
    try {
      const { url } = await billingApi.shareInvoice(id)
      let clientPhone: string | null = null
      if (inv.clientId) {
        try {
          clientPhone = (await customerApi.get(inv.clientId)).phone ?? null
        } catch {
          clientPhone = null
        }
      }
      const to = waPhone(clientPhone ?? profile?.phone)
      const agency = profile?.name ?? brand?.name ?? 'Orbit'
      // The public share URL is the HTML preview; /pdf is the on-the-fly PDF
      // download (nothing stored) — that's what the client gets on WhatsApp.
      // A fresh ?ts= busts any browser/WhatsApp/download cache of the PDF.
      const pdfUrl = `${url}/pdf?ts=${Date.now()}`
      const msg = `Hola ${inv.clientName ?? ''}, ${agency} te comparte la factura N.° ${inv.invoiceNumber} por ${fmtMoney(inv.total, profile?.currency)}. Gracias por confiar en nosotros.\n${pdfUrl}`.trim()
      const href = to ? `https://wa.me/${to}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
      window.open(href, '_blank')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo abrir WhatsApp.')
    }
  }

  // ── Payment balance math ────────────────────────────────────────────────────
  // The panel prefills what is still owed and never lets the operator type more
  // than that; the Worker enforces the same rule server-side.
  const outstanding = inv?.outstanding ?? 0
  const agencyFx = profile?.exchangeRateNioPerUsd ?? null
  const nioRate = cur === 'NIO' ? Number(fx) || agencyFx || 0 : 1
  const paymentUsd = amount.trim() === '' ? 0 : cur === 'NIO' ? (nioRate > 0 ? round2(Number(amount) / nioRate) : 0) : round2(Number(amount))
  const missingRate = cur === 'NIO' && !(nioRate > 0)
  const exceedsBalance = paymentUsd > outstanding + 0.01
  const remainingAfter = round2(Math.max(0, outstanding - paymentUsd))

  // Autofill the remaining balance: USD as-is, NIO converted with the agency rate.
  useEffect(() => {
    if (!inv) return
    if (cur === 'USD') setAmount(inv.outstanding > 0 ? String(inv.outstanding) : '')
    else {
      const rate = Number(fx) || profile?.exchangeRateNioPerUsd || 0
      setAmount(rate > 0 && inv.outstanding > 0 ? String(round2(inv.outstanding * rate)) : '')
    }
    // Only re-run for a newly loaded/updated invoice — typing must not overwrite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id, inv?.outstanding])

  function switchCurrency(next: Currency) {
    setCur(next)
    const rate = Number(fx) || agencyFx || 0
    if (next === 'NIO' && !fx && agencyFx) setFx(String(agencyFx))
    if (next === 'USD') setAmount(outstanding > 0 ? String(outstanding) : '')
    else setAmount(rate > 0 && outstanding > 0 ? String(round2(outstanding * rate)) : '')
  }

  function changeFx(value: string) {
    setFx(value)
    const rate = Number(value) || 0
    if (cur === 'NIO') setAmount(rate > 0 && outstanding > 0 ? String(round2(outstanding * rate)) : '')
  }

  /** Open the review modal — invalid amounts never reach it. */
  function requestPayment() {
    const amt = Number(amount)
    if (!(amt > 0)) return setErr('Monto inválido.')
    if (!pm) return setErr('Selecciona un método de pago.')
    if (missingRate) return setErr('Ingresá la tasa de cambio (córdobas por dólar).')
    if (exceedsBalance) return setErr('El monto supera el saldo pendiente de la factura.')
    setPayConfirmOpen(true)
  }

  function addPayment() {
    const amt = Number(amount)
    if (!(amt > 0)) return setErr('Monto inválido.')
    if (!pm) return setErr('Selecciona un método de pago.')
    if (missingRate) return setErr('Ingresá la tasa de cambio (córdobas por dólar).')
    if (exceedsBalance) return setErr('El monto supera el saldo pendiente de la factura.')
    const input: ApplyPaymentInput = {
      method: pm,
      bank: bank || null,
      currency: cur,
      amount: amt,
      fxRate: cur === 'NIO' ? nioRate || null : null,
      reference: reference.trim() || null,
      comments: comments.trim() || null,
    }
    void (async () => {
      setBusy(true)
      setErr(null)
      try {
        setInv(await billingApi.applyPayment(id, input))
        onChanged?.()
        setAmount('')
        setFx('')
        setReference('')
        setComments('')
      } catch (e) {
        // Surface the (server) reason in the drawer and let the operator retry.
        setErr(e instanceof Error ? e.message : 'No se pudo registrar el pago.')
      } finally {
        setBusy(false)
        setPayConfirmOpen(false)
      }
    })()
  }

  return (
    <div class="fixed inset-0 z-40 flex justify-end bg-black/40 print:static print:bg-transparent" onClick={onClose}>
      <div class="flex h-full w-full max-w-2xl flex-col bg-neutral-bg shadow-xl print:hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div class="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
          <div class="flex items-center gap-3">
            <span class="text-lg font-bold text-secondary">Factura #{inv?.invoiceNumber ?? '…'}</span>
            {inv && <StatusPill s={inv.status} />}
            {inv?.closedAt && (
              <span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700" title={`Cerrada ${fmtDate(inv.closedAt)} por ${inv.closedBy ?? '—'}`}>
                <Lock class="h-3 w-3" /> cerrada
              </span>
            )}
          </div>
          <div class="flex items-center gap-1">
            {inv && canWrite && (
              <Tooltip text="Enviar factura por WhatsApp">
                <button
                  aria-label={`Enviar factura #${inv.invoiceNumber} por WhatsApp`}
                  onClick={shareToWhatsApp}
                  class="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-700"
                >
                  <WhatsAppIcon size={16} />
                </button>
              </Tooltip>
            )}
            {inv && canWrite && (
              <Tooltip text="Copiar link público de la factura">
                <button
                  aria-label={`Copiar link público de la factura #${inv.invoiceNumber}`}
                  onClick={async () => {
                    try {
                      const { url } = await billingApi.shareInvoice(id)
                      navigator.clipboard?.writeText(url)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : 'No se pudo generar el link.')
                    }
                  }}
                  class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  {copied ? <Check class="h-4 w-4 text-green-600" /> : <Link2 class="h-4 w-4" />}
                </button>
              </Tooltip>
            )}
            {inv && (
              <Tooltip text="Imprimir PDF">
                <button
                  aria-label={`Imprimir factura #${inv.invoiceNumber}`}
                  onClick={() => window.print()}
                  class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Printer class="h-4 w-4" />
                </button>
              </Tooltip>
            )}
            <button aria-label="Cerrar detalle de factura" onClick={onClose} class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
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
                  {fmtDate(inv.issueDate)} · Año {inv.fiscalYear}
                  <InvoiceDaysBadge issueDate={inv.issueDate} paidAt={inv.paidAt} status={inv.status} />
                </div>
                {inv.status === 'PAID' && inv.paidAt && <div class="text-[11px] text-gray-400">Pagada el {fmtDate(inv.paidAt)}</div>}
                <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span class="text-gray-400">Total</span><div class="text-lg font-bold text-secondary">{fmtMoney(inv.total, profile?.currency)}</div>{inv && profile && altCurrencyTotal(inv.total, profile.currency, profile.exchangeRateNioPerUsd) && <div class="text-[11px] text-gray-400">{altCurrencyTotal(inv.total, profile.currency, profile.exchangeRateNioPerUsd)}</div>}</div>
                  <div><span class="text-gray-400">Utilidad</span><div class="font-semibold text-green-700">{fmtMoney(inv.profit, profile?.currency)}{inv.margin != null && <span class="ml-1 text-xs text-gray-400">({Math.round(inv.margin * 100)}%)</span>}</div></div>
                  <div>
                    <span class="text-gray-400">Pagado</span>
                    <div class="font-medium">{fmtMoney(inv.paidUsd, profile?.currency)}</div>
                    {profile && altCurrencyTotal(inv.paidUsd, profile.currency, profile.exchangeRateNioPerUsd) && (
                      <div class="text-[11px] text-gray-400">{altCurrencyTotal(inv.paidUsd, profile.currency, profile.exchangeRateNioPerUsd)}</div>
                    )}
                  </div>
                  <div>
                    <span class="text-gray-400">Saldo</span>
                    <div class="font-medium">{fmtMoney(inv.outstanding, profile?.currency)}</div>
                    {profile && altCurrencyTotal(inv.outstanding, profile.currency, profile.exchangeRateNioPerUsd) && (
                      <div class="text-[11px] text-gray-400">{altCurrencyTotal(inv.outstanding, profile.currency, profile.exchangeRateNioPerUsd)}</div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Persistent status banner */}
              {!inv.closedAt && inv.status === 'DRAFT' && (
                <div class="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  <Lock class="h-4 w-4 shrink-0" />
                  Borrador editable — todavía no acepta pagos. Editá las líneas y cerrá la factura cuando esté lista.
                </div>
              )}
              {inv.closedAt && inv.status !== 'VOID' && inv.status !== 'PAID' && (
                <div class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <Lock class="h-4 w-4 shrink-0" />
                  Factura cerrada — no se puede editar ni desenlazar paquetes. Los pagos siguen habilitados.
                </div>
              )}
              {inv.status === 'PAID' && (
                <div class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  <Check class="h-4 w-4 shrink-0" />
                  Factura pagada — no se permiten más cambios.
                </div>
              )}
              {inv.status === 'VOID' && (
                <div class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <Ban class="h-4 w-4 shrink-0" />
                  Factura anulada — documento inválido.
                </div>
              )}
              {/* Integrity warning (Worker-side net): a live invoice billing packages
                  without an active link risks double billing. Persistent, not dismissible. */}
              {inv.integrityWarning && (
                <div class="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
                  <ShieldAlert class="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Inconsistencia de facturación: hay paquetes facturados en las líneas sin vínculo activo. Revisa los paquetes enlazados y reporta esto a soporte antes de cobrar de nuevo.
                  </span>
                </div>
              )}

              {/* Lines */}
              <Card>
                <div class="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Líneas</div>
                <table class="w-full text-left text-sm">
                  <tbody>
                    {inv.lines.map((l) => {
                      let guia = l.packageGuia ?? null
                      let tracking = l.packageTracking ?? null
                      if (!guia && !tracking) {
                        const pkg = l.packageId ? inv.packages.find((p) => p.packageId === l.packageId) : null
                        if (pkg) {
                          guia = pkg.guia ?? null
                          tracking = pkg.tracking ?? null
                        } else if (inv.packages.length === 1 && l.lineType === 'freight') {
                          guia = inv.packages[0].guia ?? null
                          tracking = inv.packages[0].tracking ?? null
                        }
                      }
                      return (
                        <tr key={l.lineNo} class="border-b border-gray-50 last:border-0">
                          <td class="px-4 py-2">
                            {l.lineType === 'freight' ? (
                              <div class="font-medium text-gray-800">{guia ?? ''}</div>
                            ) : (
                              <div>{l.description ?? 'Otro cargo'}</div>
                            )}
                            {tracking && <div class="text-[11px] text-gray-500">{tracking}</div>}
                            <div class="text-[11px] text-gray-400">
                              {l.freightType ? `${FREIGHT_LABEL[l.freightType]} · ` : ''}
                              {l.priceTier ? (TIER_LABEL[l.priceTier] ?? l.priceTier) : l.lineType === 'other' ? 'cargo adicional' : l.pricingSource === 'package_snapshot' ? 'cuota fija' : 'fuera de catálogo'}
                              {l.pricingSource === 'package_snapshot'
                                ? ' · 1 unidad'
                                : l.quantityLbs != null && l.quantityLbs > 0
                                  ? ` · ${l.quantityLbs} lb`
                                  : ''}
                            </div>
                          </td>
                          <td class="px-4 py-2 text-right font-medium">{fmtMoney(l.total, profile?.currency)}</td>
                        </tr>
                      )
                    })}
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
                        <span class="font-medium">{p.method ? (METHOD_LABEL[p.method] ?? p.method) : (p.raw ?? '—')}</span>
                        {p.bank && <span class="text-gray-400"> · {p.bank}</span>}
                        {p.reference && <span class="text-gray-400"> · Ref: {p.reference}</span>}
                        {p.comments && <span class="text-gray-400"> · {p.comments}</span>}
                        {p.quarantined && <span class="ml-1 rounded bg-yellow-50 px-1 text-[10px] text-yellow-700">revisar</span>}
                        <div class="text-[11px] text-gray-400">{fmtDate(p.paidAt)}</div>
                      </div>
                      <div class="text-right">
                        <div>{p.amountUsd != null ? fmtMoney(p.amountUsd, profile?.currency) : '—'}</div>
                        {/* Córdobas stay visible next to the USD equivalent: the
                            deposit was made in NIO and accounting needs both. */}
                        {p.currency === 'NIO' && p.amount != null && (
                          <div class="text-[11px] font-normal text-gray-500">({fmtMoney(p.amount, 'NIO')} en córdobas)</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {canWrite && inv.status !== 'VOID' && inv.status !== 'PAID' && (
                  <div class="space-y-2 border-t border-gray-100 bg-gray-50/60 p-3">
                    {!inv.closedAt && (
                      <div class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                        <Lock class="h-3.5 w-3.5 shrink-0" />
                        Cierre la factura antes de registrar pagos.
                      </div>
                    )}
                    {inv.closedAt && (
                      <>
                        <div class="grid grid-cols-2 gap-2">
                          <Field label="Método">
                            <select class={inputCls} value={pm} onChange={(e) => setPm((e.target as HTMLSelectElement).value)}>
                              {methods.map((m) => <option key={m} value={m}>{METHOD_LABEL[m] ?? m}</option>)}
                            </select>
                          </Field>
                          <Field label="Moneda">
                            <select class={inputCls} value={cur} onChange={(e) => switchCurrency((e.target as HTMLSelectElement).value as Currency)}>
                              <option value="USD">USD</option>
                              <option value="NIO">NIO (córdobas)</option>
                            </select>
                          </Field>
                          <Field label="Banco (opcional)">
                            <select class={inputCls} value={bank} onChange={(e) => setBank((e.target as HTMLSelectElement).value)}>
                              <option value="">—</option>
                              {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </Field>
                          <Field label="Referencia (opcional)">
                            <input class={inputCls} value={reference} placeholder="N.º de transferencia" onInput={(e) => setReference((e.target as HTMLInputElement).value)} />
                          </Field>
                          <Field label={cur === 'NIO' ? 'Monto (NIO)' : 'Monto (USD)'}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              class={inputCls}
                              value={amount}
                              aria-invalid={exceedsBalance || missingRate}
                              onInput={(e) => setAmount((e.target as HTMLInputElement).value)}
                            />
                          </Field>
                          {cur === 'NIO' && (
                            <Field label="Tasa (NIO por USD)">
                              <input type="number" min="0" step="0.01" class={inputCls} value={fx} onInput={(e) => changeFx((e.target as HTMLInputElement).value)} placeholder="36.5" />
                            </Field>
                          )}
                          {exceedsBalance && (
                            <p class="col-span-2 text-[11px] font-medium text-red-600" role="alert">
                              El monto supera el saldo pendiente ({fmtMoney(outstanding, profile?.currency)}). Ajustá el pago para no
                              cobrar de más.
                            </p>
                          )}
                          {!exceedsBalance && missingRate && (
                            <p class="col-span-2 text-[11px] font-medium text-red-600" role="alert">
                              Ingresá la tasa de cambio (córdobas por dólar) para poder convertir el pago.
                            </p>
                          )}
                          {!exceedsBalance && !missingRate && outstanding > 0 && (
                            <p class="col-span-2 text-[11px] text-gray-500">
                              Saldo pendiente: {fmtMoney(outstanding, profile?.currency)}
                              {agencyFx ? ` (${fmtMoney(round2(outstanding * agencyFx), 'NIO')} a ${agencyFx.toFixed(2)} NIO/USD)` : ''}. El monto
                              se precarga con el restante; podés registrar un pago parcial.
                            </p>
                          )}
                          <Field label="Comentarios (opcional)">
                            <input class={inputCls} value={comments} placeholder="Nota sobre el pago" onInput={(e) => setComments((e.target as HTMLInputElement).value)} />
                          </Field>
                        </div>
                        <Button onClick={requestPayment} disabled={busy || !pm || exceedsBalance || missingRate}>Revisar y registrar pago</Button>
                      </>
                    )}
                  </div>
                )}
              </Card>

              {/* Linear history: every action from generation to payment */}
              {events.length > 0 && (
                <Card>
                  <div class="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Historial</div>
                  <ol class="px-4 py-3">
                    {events.map((ev, i) => (
                      <li key={i} class="relative flex gap-3 pb-3 last:pb-0">
                        {i < events.length - 1 && <span class="absolute left-[5px] top-3 h-full w-px bg-gray-200" aria-hidden="true" />}
                        <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <div class="min-w-0">
                          <div class="text-sm font-medium text-secondary">{ev.action}</div>
                          {ev.detail && <div class="text-xs text-gray-500">{ev.detail}</div>}
                          <div class="text-[11px] text-gray-400">
                            {fmtDateTime(ev.createdAt)}
                            {ev.actor ? ` · ${ev.actor}` : ''}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}

              {/* Linked packages */}
              <Card>
                <div class="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Paquetes enlazados</div>
                <div class="divide-y divide-gray-50">
                  {inv.packages.length === 0 && <div class="px-4 py-3 text-sm text-gray-400">Sin paquetes enlazados.</div>}
                  {inv.packages.map((p) => (
                    <div key={p.packageId} class="flex items-center justify-between px-4 py-2 text-sm">
                      <span class="flex items-center gap-2">
                        <Package class="h-3.5 w-3.5 text-gray-400" />
                        <span>{p.guia ?? p.matchedOc ?? p.packageId.slice(0, 8)}</span>
                        {p.tracking && <span class="text-[11px] text-gray-500">{p.tracking}</span>}
                        <span class="text-[10px] text-gray-400">({p.source})</span>
                      </span>
                      {canWrite && !inv.closedAt && p.guia && (
                        <Tooltip text={`Desenlazar ${p.guia}`}>
                          <button aria-label={`Desenlazar el paquete ${p.guia} de la factura #${inv.invoiceNumber}`} onClick={() => run(() => billingApi.unlinkPackage(id, p.packageId))} class="text-gray-300 hover:text-red-500">
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
                {canWrite && !inv.closedAt && (
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

              {canWrite && inv.status !== 'VOID' && !inv.closedAt && (
                <div class="flex flex-wrap gap-2">
                  <Tooltip text="Cerrar bloquea líneas, montos y paquetes: la factura deja de editarse y habilita registrar pagos. Solo podrá anularse.">
                    <Button disabled={busy} onClick={() => setPendingAction('close')}>
                      <Lock class="h-4 w-4" /> Cerrar factura
                    </Button>
                  </Tooltip>
                  <Tooltip text="Anular marca la factura como inválida y libera sus paquetes para volver a facturarlos. No se puede deshacer.">
                    <Button variant="danger" disabled={busy} onClick={() => setPendingAction('void')}>
                      <Ban class="h-4 w-4" /> Anular factura
                    </Button>
                  </Tooltip>
                </div>
              )}
              {canWrite && inv.status !== 'VOID' && inv.closedAt && (
                <Tooltip text="Anular una factura cerrada conserva los pagos registrados, libera los paquetes y deja el documento como inválido. No se puede deshacer.">
                  <Button variant="danger" disabled={busy} onClick={() => setPendingAction('void')}>
                    <Ban class="h-4 w-4" /> Anular factura
                  </Button>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction
          setPendingAction(null)
          if (action === 'close') void run(() => billingApi.closeInvoice(id))
          else if (action === 'void') void run(() => billingApi.voidInvoice(id, 'Anulada desde el panel'))
        }}
        variant={pendingAction === 'close' ? 'warning' : 'danger'}
        title={pendingAction === 'close' ? '¿Cerrar la factura?' : '¿Anular la factura?'}
        confirmLabel={pendingAction === 'close' ? 'Cerrar factura' : 'Anular factura'}
        loading={busy}
        message={
          pendingAction === 'close'
            ? 'Al cerrar la factura, sus líneas, montos y paquetes quedarán bloqueados. Después solo podrán registrarse pagos o anularse la factura. ¿La factura está lista para cerrarse?'
            : inv?.closedAt
              ? 'Se liberarán los paquetes enlazados, los pagos registrados se conservarán y la factura quedará como inválida. No se puede deshacer.'
              : 'Se liberarán los paquetes enlazados y la factura quedará como inválida. No se puede deshacer.'
        }
      />

      {/* Payment review — the post only fires after this confirmation. */}
      <Modal open={payConfirmOpen && inv !== null} onClose={() => (!busy ? setPayConfirmOpen(false) : undefined)} title="Confirmar registro de pago" size="md">
        {inv && (
          <div class="space-y-3">
            <p class="text-sm text-gray-600">
              Revisá el pago antes de registrarlo. La acción queda en el historial de la factura y no se puede deshacer.
            </p>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3 text-sm">
              <div>
                <dt class="text-xs text-gray-400">Factura</dt>
                <dd class="font-medium text-gray-800">#{inv.invoiceNumber}</dd>
              </div>
              <div>
                <dt class="text-xs text-gray-400">Cliente</dt>
                <dd class="text-gray-700">{inv.clientName ?? '—'}</dd>
              </div>
              <div>
                <dt class="text-xs text-gray-400">Total</dt>
                <dd class="text-gray-700">
                  {fmtMoney(inv.total, profile?.currency)}
                  {profile && altCurrencyTotal(inv.total, profile.currency, profile.exchangeRateNioPerUsd) && (
                    <span class="block text-[11px] text-gray-400">{altCurrencyTotal(inv.total, profile.currency, profile.exchangeRateNioPerUsd)}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-gray-400">Pagado</dt>
                <dd class="text-gray-700">
                  {fmtMoney(inv.paidUsd, profile?.currency)}
                  {profile && altCurrencyTotal(inv.paidUsd, profile.currency, profile.exchangeRateNioPerUsd) && (
                    <span class="block text-[11px] text-gray-400">{altCurrencyTotal(inv.paidUsd, profile.currency, profile.exchangeRateNioPerUsd)}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-gray-400">Saldo pendiente</dt>
                <dd class="font-medium text-gray-800">
                  {fmtMoney(outstanding, profile?.currency)}
                  {profile && altCurrencyTotal(outstanding, profile.currency, profile.exchangeRateNioPerUsd) && (
                    <span class="block text-[11px] font-normal text-gray-400">{altCurrencyTotal(outstanding, profile.currency, profile.exchangeRateNioPerUsd)}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-gray-400">Método</dt>
                <dd class="text-gray-700">{METHOD_LABEL[pm] ?? pm}{bank ? ` · ${bank}` : ''}</dd>
              </div>
              <div>
                <dt class="text-xs text-gray-400">Monto a registrar</dt>
                <dd class="font-semibold text-secondary">{cur === 'NIO' ? `${Number(amount).toFixed(2)} NIO` : fmtMoney(Number(amount), profile?.currency)}</dd>
              </div>
              <div>
                <dt class="text-xs text-gray-400">{cur === 'NIO' ? 'Equivalente en USD' : 'Saldo después del pago'}</dt>
                <dd class="text-gray-700">{cur === 'NIO' ? fmtMoney(paymentUsd, profile?.currency) : fmtMoney(remainingAfter, profile?.currency)}</dd>
              </div>
              {cur === 'NIO' && (
                <>
                  <div>
                    <dt class="text-xs text-gray-400">Tasa aplicada</dt>
                    <dd class="text-gray-700">{nioRate.toFixed(2)} NIO/USD</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-gray-400">Saldo después del pago</dt>
                    <dd class="text-gray-700">
                      {fmtMoney(remainingAfter, profile?.currency)}
                      {nioRate > 0 && <span class="block text-[11px] text-gray-400">{fmtMoney(round2(remainingAfter * nioRate), 'NIO')}</span>}
                    </dd>
                  </div>
                </>
              )}
              {reference && (
                <div class="col-span-2">
                  <dt class="text-xs text-gray-400">Referencia</dt>
                  <dd class="text-gray-700">{reference}</dd>
                </div>
              )}
              {comments && (
                <div class="col-span-2">
                  <dt class="text-xs text-gray-400">Comentarios</dt>
                  <dd class="text-gray-700">{comments}</dd>
                </div>
              )}
            </dl>
            {remainingAfter > 0 ? (
              <div class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
                <AlertTriangle class="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Es un pago parcial: la factura quedará con un saldo de {fmtMoney(remainingAfter, profile?.currency)}. Cuando se
                  complete, pasará a pagada automáticamente.
                </span>
              </div>
            ) : (
              <div class="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
                <Check class="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Con este pago la factura queda pagada en su totalidad.</span>
              </div>
            )}
            <div class="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setPayConfirmOpen(false)} disabled={busy}>
                Volver
              </Button>
              <Button onClick={addPayment} disabled={busy}>
                {busy ? 'Registrando…' : 'Registrar pago'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Print-only rendering (isolated by .invoice-print in global.css). */}
      {inv && (
        <InvoicePrint
          inv={inv}
          brand={brand ?? undefined}
          profile={profile ? { ruc: profile.ruc, address: profile.address, phone: profile.phone, currency: profile.currency, exchangeRateNioPerUsd: profile.exchangeRateNioPerUsd } : undefined}
        />
      )}
    </div>
  )
}
