import { Loader2 } from 'lucide-preact'
import { type CurrencyCode } from '../../lib/config'
import { fmtMoney } from '../../lib/format'

export interface ChargeSummaryProps {
  /** Tariff / service that priced the charge (rate card name). */
  cardName?: string | null
  /** Preformatted quantity line, e.g. "5 lb × $7.00" or "1 guía". */
  quantityLabel?: string | null
  customerCharge: number | null
  currency: CurrencyCode
  /** How the charge is expressed: "por guía", "por lb", "por unidad". */
  unitLabel?: string
  providerCost?: number | null
  /** Utilidad = cobro − costo. Never show a made-up number: omit when unknown. */
  profit?: number | null
  /** Internal cost/profit are finance-only (admin|billing). */
  canSeeCosts?: boolean
  note?: string
  title?: string
  class?: string
  /** Quote in flight (weight typed, service/tariff switched): shows a loader
   *  inside the card instead of flashing the old or an empty summary. */
  loading?: boolean
}

/**
 * Reusable charge summary: the create-package modal and the invoice editor
 * share the same rows, wording and visibility rules (cobro al cliente, costo
 * interno, utilidad). Money always arrives resolved — this only formats.
 */
export default function ChargeSummary({
  cardName,
  quantityLabel,
  customerCharge,
  currency,
  unitLabel,
  providerCost,
  profit,
  canSeeCosts = false,
  note,
  title = 'Resumen de cobro',
  class: cls = '',
  loading = false,
}: ChargeSummaryProps) {
  return (
    <div class={`rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm ${cls}`} aria-busy={loading}>
      <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</div>
      {loading ? (
        <div class="flex items-center gap-2 py-1 text-xs text-gray-500" role="status" aria-live="polite">
          <Loader2 class="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
          Calculando…
          <span class="ml-auto h-3 w-16 animate-pulse rounded bg-gray-200" aria-hidden="true" />
        </div>
      ) : (
        <>
          {cardName && (
            <div class="flex items-center justify-between gap-3">
              <span class="text-gray-600">Tarifa</span>
              <span class="text-right font-medium text-gray-800">{cardName}</span>
            </div>
          )}
          {quantityLabel && (
            <div class="flex items-center justify-between gap-3">
              <span class="text-gray-600">Cantidad</span>
              <span class="text-right text-gray-700">{quantityLabel}</span>
            </div>
          )}
          <div class="flex items-center justify-between gap-3">
            <span class="text-gray-600">Cobro al cliente</span>
            <span class="text-right font-semibold text-secondary">
              {customerCharge == null ? '…' : `${fmtMoney(customerCharge, currency)}${unitLabel ? ` ${unitLabel}` : ''}`}
            </span>
          </div>
          {canSeeCosts && providerCost != null && (
            <div class="flex items-center justify-between gap-3">
              <span class="text-gray-600">Costo interno</span>
              <span class="text-right text-gray-700">{fmtMoney(providerCost, currency)}</span>
            </div>
          )}
          {canSeeCosts && profit != null && (
            <div class="flex items-center justify-between gap-3">
              <span class="text-gray-600">Utilidad</span>
              <span class="text-right font-medium text-emerald-700">{fmtMoney(profit, currency)}</span>
            </div>
          )}
          {note && <p class="mt-1 text-xs text-gray-400">{note}</p>}
        </>
      )}
    </div>
  )
}
