import { Archive, Ban, Eye, Lock, Pencil } from 'lucide-preact'
import type { InvoiceListRow } from '../../lib/billing'
import { Tooltip } from '../ui'

/**
 * Row actions for the invoices table, driven by the invoice status.
 * - DRAFT abierto: ver, editar, cerrar, anular.
 * - ISSUED / PARTIAL / PAID: ver y anular (nunca cerrar ni editar).
 * - VOID: ver y archivar (limpiar la lista).
 * - Archivar (cualquier estado, canWrite): la factura sale de lista/reportes y
 *   libera sus paquetes — usar para borrar registros por error, no para anular.
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
  onArchive,
}: {
  row: InvoiceListRow
  canWrite: boolean
  busy: boolean
  onView: () => void
  onEdit: () => void
  onClose: () => void
  onVoid: () => void
  onArchive: () => void
}) {
  const open = row.status === 'DRAFT' && !row.closedAt
  const num = row.invoiceNumber
  return (
    <div class="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Tooltip text={`Ver factura #${num}`}>
        <button aria-label={`Ver factura #${num}`} onClick={onView} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <Eye class="h-4 w-4" />
        </button>
      </Tooltip>
      {canWrite && open && (
        <Tooltip text={`Editar factura #${num}`}>
          <button aria-label={`Editar factura #${num}`} onClick={onEdit} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary">
            <Pencil class="h-4 w-4" />
          </button>
        </Tooltip>
      )}
      {canWrite && open && (
        <Tooltip text={`Cerrar factura #${num} (pasa a emitida)`}>
          <button aria-label={`Cerrar factura #${num}`} disabled={busy} onClick={onClose} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-green-700">
            <Lock class="h-4 w-4" />
          </button>
        </Tooltip>
      )}
      {canWrite && row.status !== 'VOID' && (
        <Tooltip text={`Anular factura #${num}`}>
          <button aria-label={`Anular factura #${num}`} disabled={busy} onClick={onVoid} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600">
            <Ban class="h-4 w-4" />
          </button>
        </Tooltip>
      )}
      {canWrite && (
        <Tooltip text={`Archivar factura #${num} (la oculta de la lista y reportes)`}>
          <button aria-label={`Archivar factura #${num}`} disabled={busy} onClick={onArchive} class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-amber-600">
            <Archive class="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}