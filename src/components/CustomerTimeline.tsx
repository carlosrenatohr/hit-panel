import { Ban, CheckCircle2, History, Package, Pencil, Plus, UserCheck, Archive, RotateCcw } from 'lucide-preact'
import type { CustomerEvent } from '../lib/customer'
import { fmtDateTime } from '../lib/format'

/** Friendly Spanish copy for each known audit action (fallback = raw action). */
const ACTION_META: Record<string, { label: string; icon: typeof Plus }> = {
  'client.create': { label: 'Cliente creado', icon: Plus },
  'client.update': { label: 'Datos actualizados', icon: Pencil },
  'client.deactivate': { label: 'Cliente deshabilitado', icon: Ban },
  'client.reactivate': { label: 'Cliente reactivado', icon: UserCheck },
  'client.delete': { label: 'Cliente archivado', icon: Archive },
  'invoice.issued': { label: 'Factura emitida', icon: CheckCircle2 },
  'invoice.paid': { label: 'Factura pagada', icon: CheckCircle2 },
  'package.assigned': { label: 'Paquete asignado', icon: Package },
  'package.deleted': { label: 'Paquete eliminado', icon: RotateCcw },
}

function eventMeta(action: string) {
  return ACTION_META[action] ?? { label: action, icon: History }
}

function actorLabel(e: CustomerEvent): string {
  return e.actorEmail ?? e.actorId ?? 'Sistema'
}

/** Extracts a short human summary from the event metadata. */
function summaryOf(e: CustomerEvent): string | null {
  const m = e.metadata
  if (!m) return null
  if (e.action === 'client.delete' && m.name) return `«${m.name}» · ${m.packageCount ?? 0} paq · ${m.invoiceCount ?? 0} fact`
  if (e.action === 'client.create' && m.name) return `«${m.name}»`
  if (e.action === 'client.update' && m.changes) {
    const keys = Object.keys(m.changes as Record<string, unknown>)
    return keys.length ? `Cambios: ${keys.join(', ')}` : null
  }
  return null
}

/** One event row on the vertical timeline. */
function TimelineRow({ event }: { event: CustomerEvent }) {
  const meta = eventMeta(event.action)
  const Icon = meta.icon
  return (
    <li class="relative flex gap-3 pb-6 last:pb-0">
      {/* vertical line */}
      <span class="absolute left-[13px] top-8 h-[calc(100%-2rem)] w-px bg-gray-100" aria-hidden="true" />
      <span class="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon class="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span class="text-sm font-semibold text-gray-800">{meta.label}</span>
          <span class="text-xs text-gray-400">{fmtDateTime(event.createdAt)}</span>
        </div>
        {summaryOf(event) && <p class="mt-0.5 truncate text-xs text-gray-500" title={summaryOf(event) ?? undefined}>{summaryOf(event)}</p>}
        <p class="mt-0.5 text-xs text-gray-400">
          por <span class="text-gray-500">{actorLabel(event)}</span>
        </p>
      </div>
    </li>
  )
}

/** Visual event timeline (rastro/bitácora) — one vertical event per client action. */
export default function CustomerTimeline({ events }: { events: CustomerEvent[] }) {
  if (events.length === 0) {
    return <p class="py-6 text-center text-sm text-gray-400">Sin eventos registrados para este cliente.</p>
  }
  return (
    <ol class="px-1 pt-4">
      {events.map((e) => (
        <TimelineRow key={e.id} event={e} />
      ))}
    </ol>
  )
}

export function EventDot({ action }: { action: string }) {
  const meta = eventMeta(action)
  const Icon = meta.icon
  return <Icon class="h-3.5 w-3.5" aria-hidden="true" />
}