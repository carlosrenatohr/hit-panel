import { Ban, Eye, Lock, Pencil } from 'lucide-preact'
import type { InvoiceListRow } from '../../lib/billing'

/**
 * Row actions for the invoices table, driven by the invoice status.
 * - DRAFT abierto: ver, editar, cerrar, anular.
 * - ISSUED / PARTIAL / PAID: ver y anular (nunca cerrar ni editar).
 * - VOID: solo ver.
 * Escrituras se muestran solo con canWrite. El click en la fila se detiene aquí
 * para que los iconos no abran el detalle accidentalmente.
 */
export default function InvoiceRowActions({
  row,
  canWrite,
  busy,
  onView,
  onEdit,
  onClose,
  onVoid,
}: {
  row: InvoiceListRow
  canWrite: boolean
  busy: boolean
  onView: () => void
  onEdit: () => void
  onClose: () => void
  onVoid: () => void
}) {
  const open = row.status === 'DRAFT' && !row.closedAt
  return (
    <div class="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button aria-label="Ver factura" title="Ver detalle" onClick={onView} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Eye class="h-4 w-4" />
      </button>
      {canWrite && open && (
        <button aria-label="Editar factura" title="Editar borrador" onClick={onEdit} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary">
          <Pencil class="h-4 w-4" />
        </button>
      )}
      {canWrite && open && (
        <button aria-label="Cerrar factura" title="Cerrar (pasa a emitida)" disabled={busy} onClick={onClose} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-green-700">
          <Lock class="h-4 w-4" />
        </button>
      )}
      {canWrite && row.status !== 'VOID' && (
        <button aria-label="Anular factura" title="Anular" disabled={busy} onClick={onVoid} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600">
          <Ban class="h-4 w-4" />
        </button>
      )}
    </div>
  )
}