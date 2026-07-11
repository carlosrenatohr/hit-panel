import type { InvoiceView } from '../../lib/billing'
import { FREIGHT_LABEL, fmtDate, fmtUsd, INVOICE_STATUS_LABEL } from '../../lib/format'

// Pluggable print template. Hidden on screen (`hidden print:block`), isolated on
// print by the `.invoice-print` rule in global.css. This is the seam for the
// owner's future custom format (logo/legal/RUC): swap this component's markup only.
export default function InvoicePrint({ inv }: { inv: InvoiceView }) {
  return (
    <div class="invoice-print hidden bg-white p-8 text-sm text-gray-900 print:block">
      <div class="mb-6 flex items-start justify-between border-b border-gray-300 pb-4">
        <div class="flex items-center gap-3">
          <img src="/logo-mark.png" alt="HIT Cargo" class="h-12 w-12 object-contain" />
          <div>
            <div class="text-lg font-bold">HIT Cargo</div>
            <div class="text-xs text-gray-500">Recibo de venta</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-xs text-gray-500">Factura N.º</div>
          <div class="text-xl font-bold">{inv.invoiceNumber}</div>
          <div class="text-xs text-gray-500">{fmtDate(inv.issueDate)}</div>
        </div>
      </div>

      <div class="mb-4 grid grid-cols-2 gap-4">
        <div>
          <div class="text-xs uppercase tracking-wide text-gray-400">Cliente</div>
          <div class="font-medium">{inv.clientName ?? '—'}</div>
          {inv.address && <div class="text-xs text-gray-500">{inv.address}</div>}
        </div>
        <div class="text-right">
          <div class="text-xs uppercase tracking-wide text-gray-400">Estado</div>
          <div class="font-medium">{INVOICE_STATUS_LABEL[inv.status] ?? inv.status}</div>
        </div>
      </div>

      <table class="mb-4 w-full border-collapse text-left">
        <thead>
          <tr class="border-b border-gray-300 text-xs uppercase tracking-wide text-gray-500">
            <th class="py-1">Descripción</th>
            <th class="py-1">Flete</th>
            <th class="py-1 text-right">Libras</th>
            <th class="py-1 text-right">P. unit.</th>
            <th class="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.lineNo} class="border-b border-gray-100">
              <td class="py-1">{l.description ?? '—'}</td>
              <td class="py-1">{FREIGHT_LABEL[l.freightType]}</td>
              <td class="py-1 text-right">{l.quantityLbs}</td>
              <td class="py-1 text-right">{fmtUsd(l.unitPrice)}</td>
              <td class="py-1 text-right">{fmtUsd(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div class="ml-auto w-56 space-y-1">
        <div class="flex justify-between border-t border-gray-300 pt-2 text-base font-bold">
          <span>Total</span>
          <span>{fmtUsd(inv.total)}</span>
        </div>
        {inv.paidUsd > 0 && (
          <div class="flex justify-between text-gray-600">
            <span>Pagado</span>
            <span>{fmtUsd(inv.paidUsd)}</span>
          </div>
        )}
        {inv.outstanding > 0 && (
          <div class="flex justify-between font-medium text-gray-800">
            <span>Saldo</span>
            <span>{fmtUsd(inv.outstanding)}</span>
          </div>
        )}
      </div>

      {inv.observations && <div class="mt-6 text-xs text-gray-500">Obs: {inv.observations}</div>}
      <div class="mt-8 text-center text-[10px] text-gray-400">Gracias por su preferencia — HIT Cargo</div>
    </div>
  )
}
