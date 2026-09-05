import type { InvoiceView } from '../../lib/billing'
import { fmtMoney, FREIGHT_LABEL, fmtDate, INVOICE_STATUS_LABEL } from '../../lib/format'

export interface InvoiceBrand {
  name: string
  logoUrl: string | null
}

/** Agency profile bits printed under the agency title (all optional). */
export interface InvoiceProfile {
  ruc: string | null
  address: string | null
  phone: string | null
  currency: 'USD' | 'NIO'
}

const FALLBACK_BRAND = { name: 'HIT Cargo', logoUrl: '/logo-mark.png' }

// Pluggable print template. Hidden on screen (`hidden print:block`), isolated on
// print by the `.invoice-print` rule in global.css. The brand and profile are the
// issuing agency's (config endpoints) — never a hardcoded logo. Totals render as
// Subtotal (sum of lines) + Total (grand total, includes "otros" charges).
export default function InvoicePrint({
  inv,
  brand,
  profile,
}: {
  inv: InvoiceView
  brand?: InvoiceBrand
  profile?: InvoiceProfile
}) {
  const b = brand ?? FALLBACK_BRAND
  const logo = b.logoUrl || FALLBACK_BRAND.logoUrl
  const currency = profile?.currency ?? 'USD'
  const subtotal = inv.lines.reduce((s, l) => s + (l.total || 0), 0)
  const infoLines = [profile?.ruc && `RUC: ${profile.ruc}`, profile?.address, profile?.phone].filter(Boolean) as string[]
  return (
    <div class="invoice-print hidden bg-white p-10 text-[13px] leading-relaxed text-gray-900 print:block">
      {/* Header */}
      <div class="mb-6 flex items-start justify-between border-b-2 border-gray-900 pb-4">
        <div class="flex items-center gap-3">
          <img src={logo} alt={b.name} class="h-12 w-12 object-contain" />
          <div>
            <div class="text-xl font-extrabold tracking-tight">{b.name}</div>
            <div class="text-xs text-gray-500">Recibo de venta</div>
            {infoLines.length > 0 && (
              <div class="mt-1 text-[11px] text-gray-500">
                {infoLines.map((line, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    {line}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div class="text-right">
          <div class="text-[10px] uppercase tracking-widest text-gray-400">Recibo N.º</div>
          <div class="text-2xl font-extrabold">{inv.invoiceNumber}</div>
          <div class="text-xs text-gray-500">{fmtDate(inv.issueDate)}</div>
        </div>
      </div>

      {/* Parties */}
      <div class="mb-6 flex items-start justify-between gap-6">
        <div>
          <div class="text-[10px] uppercase tracking-widest text-gray-400">Cliente</div>
          <div class="font-semibold">{inv.clientName ?? '—'}</div>
          {inv.address && <div class="text-xs text-gray-500">{inv.address}</div>}
        </div>
        <div class="text-right">
          <div class="text-[10px] uppercase tracking-widest text-gray-400">Estado</div>
          <div class="font-semibold">{INVOICE_STATUS_LABEL[inv.status] ?? inv.status}</div>
        </div>
      </div>

      {/* Lines */}
      <table class="mb-4 w-full border-collapse">
        <thead>
          <tr class="border-y border-gray-300 text-[10px] uppercase tracking-widest text-gray-500">
            <th class="py-2 text-left font-semibold">Descripción</th>
            <th class="py-2 text-left font-semibold">Flete</th>
            <th class="py-2 text-right font-semibold">Libras</th>
            <th class="py-2 text-right font-semibold">P. unit.</th>
            <th class="py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.lineNo} class="border-b border-gray-100">
              <td class="py-2">{l.description ?? FREIGHT_LABEL[l.freightType]}</td>
              <td class="py-2">{FREIGHT_LABEL[l.freightType]}</td>
              <td class="py-2 text-right">{l.quantityLbs}</td>
              <td class="py-2 text-right">{fmtMoney(l.unitPrice, currency)}</td>
              <td class="py-2 text-right font-medium">{fmtMoney(l.total, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals: Subtotal (sum of lines) → Total (grand, includes future "otros"
          charges) → Pagado as secondary info. No saldo-pendiente row. */}
      <div class="ml-auto w-64">
        <div class="flex justify-between border-t border-gray-300 pt-2 text-sm text-gray-700">
          <span>Subtotal</span>
          <span>{fmtMoney(subtotal, currency)}</span>
        </div>
        <div class="flex justify-between border-t-2 border-gray-900 pt-2 text-lg font-extrabold">
          <span>Total</span>
          <span>{fmtMoney(inv.total, currency)}</span>
        </div>
        {inv.paidUsd > 0 && (
          <div class="flex justify-between pt-1 text-xs text-gray-500">
            <span>Pagado</span>
            <span>{fmtMoney(inv.paidUsd, currency)}</span>
          </div>
        )}
      </div>

      {inv.observations && <div class="mt-6 border-t border-gray-100 pt-3 text-xs text-gray-500">Obs: {inv.observations}</div>}
      <div class="mt-10 text-center text-[11px] text-gray-400">Gracias por su preferencia · {b.name}</div>
    </div>
  )
}
