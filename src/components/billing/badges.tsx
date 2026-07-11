import { Clock } from 'lucide-preact'
import type { InvoiceStatus } from '../../lib/billing'

function diffDays(from: string, to: string | number): number | null {
  const a = new Date(from)
  const b = typeof to === 'number' ? new Date(to) : new Date(to)
  if (isNaN(+a) || isNaN(+b)) return null
  return Math.floor((+b - +a) / 86400000)
}

/**
 * Turnaround / aging badge, mirroring the shipments DaysBadge.
 *  - PAID: days between issued and paid (only shown when > 1d, per request).
 *  - ISSUED/PARTIAL: days elapsed since issue (receivable aging), amber when it lingers.
 * Renders nothing when there's no meaningful number to show.
 */
export function InvoiceDaysBadge({ issueDate, paidAt, status }: { issueDate: string | null; paidAt: string | null; status: InvoiceStatus }) {
  if (!issueDate) return null

  if (status === 'PAID') {
    if (!paidAt) return null
    const d = diffDays(issueDate, paidAt)
    if (d == null || d <= 1) return null
    return (
      <span title={`Pagada ${d} días después de emitida`} class="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
        <Clock class="h-3 w-3" aria-hidden="true" /> {d}d
      </span>
    )
  }

  if (status === 'ISSUED' || status === 'PARTIAL') {
    const d = diffDays(issueDate, Date.now())
    if (d == null || d <= 1) return null
    const amber = d >= 15
    return (
      <span
        title={`${d} días desde la emisión, sin saldar`}
        class={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${amber ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}
      >
        <Clock class="h-3 w-3" aria-hidden="true" /> {d}d
      </span>
    )
  }
  return null
}
