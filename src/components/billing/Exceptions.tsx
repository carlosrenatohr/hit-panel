import { AlertTriangle } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { billingApi, type Exceptions as Ex, type ExceptionRow } from '../../lib/billing'
import { Card, SectionTitle, Spinner } from '../ui'

function Section({ title, rows, onOpen }: { title: string; rows: ExceptionRow[]; onOpen: (id: string) => void }) {
  return (
    <Card>
      <SectionTitle class="justify-between">
        <span>{title}</span>
        <span class={`rounded-full px-2 py-0.5 text-xs font-semibold ${rows.length ? 'bg-yellow-50 text-yellow-800' : 'bg-gray-100 text-gray-400'}`}>{rows.length}</span>
      </SectionTitle>
      {rows.length === 0 ? (
        <div class="px-5 py-3 text-sm text-gray-400">Sin pendientes.</div>
      ) : (
        <div class="divide-y divide-gray-50">
          {rows.map((r, i) => (
            <button key={i} class="flex w-full items-center justify-between px-5 py-2 text-left text-sm hover:bg-gray-50" onClick={() => onOpen(r.invoiceId)}>
              <span class="font-medium text-secondary">#{r.invoiceNumber}<span class="ml-1 text-[11px] text-gray-400">{r.fiscalYear}</span> <span class="ml-2 font-normal text-gray-600">{r.client ?? '—'}</span></span>
              <span class="truncate pl-3 text-xs text-gray-500">{r.detail}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function ExceptionsView({ onOpen }: { onOpen: (id: string) => void }) {
  const [ex, setEx] = useState<Ex | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    billingApi
      .exceptions()
      .then((e) => !cancelled && setEx(e))
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : 'No se pudieron cargar las excepciones.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Spinner label="Cargando excepciones…" />
  if (err) return <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
  if (!ex) return null

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-2 text-sm text-gray-500">
        <AlertTriangle class="h-4 w-4 text-yellow-500" /> Elementos a revisar del import y del día a día. Clic para abrir la factura.
      </div>
      <Section title="Precios fuera de catálogo" rows={ex.offCatalog} onOpen={onOpen} />
      <Section title="Pagos en cuarentena" rows={ex.quarantinedPayments} onOpen={onOpen} />
      <Section title="Facturas sin paquete enlazado (con OC)" rows={ex.orphanInvoices} onOpen={onOpen} />
      <Card>
        <SectionTitle class="justify-between">
          <span>Clientes a revisar</span>
          <span class={`rounded-full px-2 py-0.5 text-xs font-semibold ${ex.clientsToReview.length ? 'bg-yellow-50 text-yellow-800' : 'bg-gray-100 text-gray-400'}`}>{ex.clientsToReview.length}</span>
        </SectionTitle>
        {ex.clientsToReview.length === 0 ? (
          <div class="px-5 py-3 text-sm text-gray-400">Sin pendientes.</div>
        ) : (
          <div class="divide-y divide-gray-50">
            {ex.clientsToReview.map((c) => (
              <div key={c.id} class="px-5 py-2 text-sm">{c.name}</div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
