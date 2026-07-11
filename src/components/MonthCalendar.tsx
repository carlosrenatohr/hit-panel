import { ChevronLeft, ChevronRight } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import { Card, SectionTitle, Spinner } from './ui'

export interface CalendarEvent {
  date: string // ISO (yyyy-mm-dd or full timestamp)
  kind: string
}
export interface CalendarLegend {
  kind: string
  label: string
  dot: string // tailwind bg-* class
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] // Monday-first

/**
 * Generic month overview. Owns its month state + data fetch; parents pass a
 * `loadEvents(year, month)` (month 1-12) that returns the month's events, plus a
 * legend describing each `kind`. Buckets events per day and shows counts.
 */
export default function MonthCalendar({
  title,
  legend,
  loadEvents,
}: {
  title?: string
  legend: CalendarLegend[]
  loadEvents: (year: number, month: number) => Promise<CalendarEvent[]>
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth() + 1) // 1-12
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    loadEvents(year, month)
      .then((e) => !cancelled && setEvents(e))
      .catch((x) => !cancelled && setErr(x instanceof Error ? x.message : 'No se pudo cargar el calendario.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [year, month, loadEvents])

  function shift(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y--
    } else if (m > 12) {
      m = 1
      y++
    }
    setMonth(m)
    setYear(y)
  }

  // Bucket events by day-of-month, counting per kind.
  const byDay = new Map<number, Record<string, number>>()
  for (const e of events) {
    const d = new Date(e.date)
    if (isNaN(+d) || d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month) continue
    const day = d.getUTCDate()
    const rec = byDay.get(day) ?? {}
    rec[e.kind] = (rec[e.kind] ?? 0) + 1
    byDay.set(day, rec)
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7 // Monday-first (0=Mon)
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const dotClass = Object.fromEntries(legend.map((l) => [l.kind, l.dot]))

  return (
    <Card>
      <SectionTitle class="justify-between">
        <span>{title ?? 'Calendario'}</span>
        <span class="flex items-center gap-2">
          <button aria-label="Mes anterior" onClick={() => shift(-1)} class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><ChevronLeft class="h-4 w-4" /></button>
          <span class="min-w-[8rem] text-center text-sm font-medium text-gray-700">{MONTH_NAMES[month - 1]} {year}</span>
          <button aria-label="Mes siguiente" onClick={() => shift(1)} class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><ChevronRight class="h-4 w-4" /></button>
        </span>
      </SectionTitle>

      <div class="p-4">
        {/* Legend */}
        <div class="mb-3 flex flex-wrap gap-3 text-xs text-gray-500">
          {legend.map((l) => (
            <span key={l.kind} class="inline-flex items-center gap-1.5"><span class={`h-2 w-2 rounded-full ${l.dot}`} /> {l.label}</span>
          ))}
        </div>

        {loading ? (
          <Spinner label="Cargando…" />
        ) : err ? (
          <div class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
        ) : (
          <div class="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w, i) => (
              <div key={`h${i}`} class="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400">{w}</div>
            ))}
            {cells.map((day, i) => {
              if (day == null) return <div key={`e${i}`} />
              const rec = byDay.get(day)
              return (
                <div key={day} class="min-h-[52px] rounded-lg border border-gray-100 p-1">
                  <div class="text-right text-[11px] text-gray-400">{day}</div>
                  <div class="mt-0.5 flex flex-col gap-0.5">
                    {rec &&
                      legend
                        .filter((l) => rec[l.kind])
                        .map((l) => (
                          <span key={l.kind} class="inline-flex items-center gap-1 text-[10px] text-gray-600">
                            <span class={`h-1.5 w-1.5 rounded-full ${dotClass[l.kind]}`} /> {rec[l.kind]}
                          </span>
                        ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
