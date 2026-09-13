import { Archive, Ban, CalendarDays, CheckCircle2, History, Package, Pencil, Plus, RotateCcw, UserCheck } from 'lucide-preact'
import type { CustomerEvent } from '../lib/customer'
import { fmtDateTime } from '../lib/format'

const ACTION_META: Record<string, { label: string; icon: typeof Plus; color: string; bg: string }> = {
  'client.create': { label: 'Cliente creado', icon: Plus, color: 'text-green-600', bg: 'bg-green-50' },
  'client.update': { label: 'Datos actualizados', icon: Pencil, color: 'text-blue-600', bg: 'bg-blue-50' },
  'client.deactivate': { label: 'Cliente deshabilitado', icon: Ban, color: 'text-red-500', bg: 'bg-red-50' },
  'client.reactivate': { label: 'Cliente reactivado', icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
  'client.delete': { label: 'Cliente archivado', icon: Archive, color: 'text-red-500', bg: 'bg-red-50' },
  'invoice.issued': { label: 'Factura emitida', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50' },
  'invoice.paid': { label: 'Factura pagada', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  'package.assigned': { label: 'Paquete asignado', icon: Package, color: 'text-primary', bg: 'bg-primary/5' },
  'package.deleted': { label: 'Paquete eliminado', icon: RotateCcw, color: 'text-gray-500', bg: 'bg-gray-50' },
}

function eventMeta(action: string) {
  return ACTION_META[action] ?? { label: action, icon: History, color: 'text-gray-500', bg: 'bg-gray-50' }
}

function actorLabel(e: CustomerEvent): string {
  return e.actorEmail ?? e.actorId ?? 'Sistema'
}

/** Spanish labels for metadata field names. */
const FIELD_LABELS: Record<string, string> = {
  phone: 'Teléfono',
  email: 'Email',
  address: 'Dirección',
  name: 'Nombre',
  casillero: 'Casillero',
  companyName: 'Compañía',
  taxId: 'Cédula / RUC',
  toReview: 'Requiere revisión',
  active: 'Estado',
  defaultRateCardId: 'Tarifa por defecto',
}

function summaryOf(e: CustomerEvent): string | null {
  const m = e.metadata
  if (!m) return null
  if (e.action === 'client.delete' && m.name) return `«${m.name}» · ${m.packageCount ?? 0} paq · ${m.invoiceCount ?? 0} fact`
  if (e.action === 'client.create' && m.name) return `«${m.name}»`
  if (e.action === 'client.update' && m.changes) {
    const keys = Object.keys(m.changes as Record<string, unknown>)
    if (!keys.length) return null
    const translated = keys.map((k) => FIELD_LABELS[k] ?? k)
    return `Cambios: ${translated.join(', ')}`
  }
  if (e.action === 'client.deactivate' && m.name) return `«${m.name}»`
  if (e.action === 'client.reactivate' && m.name) return `«${m.name}»`
  return null
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `hace ${days}d`
  const weeks = Math.floor(days / 7)
  return `hace ${weeks}sem`
}

function dayKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-NI', { year: 'numeric', month: 'short', day: '2-digit' })
}

function TimelineEvent({ event }: { event: CustomerEvent }) {
  const meta = eventMeta(event.action)
  const Icon = meta.icon
  return (
    <li class="flex gap-3">
      <span class={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.bg} ${meta.color}`}>
        <Icon class="h-4 w-4" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <span class="text-sm font-semibold text-gray-800">{meta.label}</span>
          <span class="flex items-center gap-1 text-xs text-gray-400">
            {relativeTime(event.createdAt)}
            <span title={fmtDateTime(event.createdAt)} class="cursor-help">·</span>
          </span>
        </div>
        {summaryOf(event) && <p class="mt-1 whitespace-normal text-xs text-gray-500">{summaryOf(event)}</p>}
        <p class="mt-1 text-xs text-gray-400">
          por <span class="text-gray-500">{actorLabel(event)}</span>
        </p>
      </div>
    </li>
  )
}

function DayGroup({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <li>
      <div class="sticky top-0 z-20 flex items-center gap-2 bg-neutral-bg py-2">
        <CalendarDays class="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <span class="h-px flex-1 bg-gray-200" />
      </div>
      <ol class="space-y-2 pb-2">{children}</ol>
    </li>
  )
}

export default function CustomerTimeline({ events }: { events: CustomerEvent[] }) {
  if (events.length === 0) {
    return (
      <div class="py-10 text-center">
        <History class="mx-auto mb-2 h-8 w-8 text-gray-300" aria-hidden="true" />
        <p class="text-sm text-gray-400">Sin eventos registrados.</p>
      </div>
    )
  }

  const grouped = new Map<string, CustomerEvent[]>()
  for (const e of events) {
    const key = dayKey(e.createdAt)
    const arr = grouped.get(key) ?? []
    arr.push(e)
    grouped.set(key, arr)
  }

  return (
    <ol class="space-y-3 pt-2">
      {[...grouped.entries()].map(([day, dayEvents]) => (
        <DayGroup key={day} label={day}>
          {dayEvents.map((e) => (
            <TimelineEvent key={e.id} event={e} />
          ))}
        </DayGroup>
      ))}
    </ol>
  )
}

export function EventDot({ action }: { action: string }) {
  const meta = eventMeta(action)
  const Icon = meta.icon
  return <Icon class="h-3.5 w-3.5" aria-hidden="true" />
}
