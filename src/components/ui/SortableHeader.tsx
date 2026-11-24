import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-preact'
import { Tooltip } from '../ui'

/**
 * The one sortable column header. One active field at a time — the owner of
 * the sort state is the list, not the header.
 *
 * Aria: the caller puts `aria-sort` on the `<th>` (`ascending`/`descending`/
 * `none`); the button keeps the action label for screen readers. The active
 * field is signalled three ways, not just colour: primary tone, a heavier
 * stroke and a slightly larger glyph inside a fixed box (so the header never
 * jumps when the sort changes).
 */
export function SortableHeader({
  label,
  field,
  sortCol,
  ascending,
  onSort,
  align = 'start',
}: {
  label: string
  field: string
  sortCol: string
  ascending: boolean
  onSort: (field: string, ascending: boolean) => void
  align?: 'start' | 'end'
}) {
  const active = sortCol === field
  const Icon = active ? (ascending ? ArrowUp : ArrowDown) : ArrowUpDown
  const nextAscending = active ? !ascending : true
  const state = active ? (ascending ? 'Orden ascendente' : 'Orden descendente') : 'Sin orden'
  return (
    <Tooltip text={`${state} · clic para ${nextAscending ? 'ascendente' : 'descendente'}`} placement="bottom" align={align}>
      <button
        type="button"
        onClick={() => onSort(field, nextAscending)}
        aria-label={`Ordenar por ${label}`}
        class={`group/sort inline-flex items-center gap-1 uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          align === 'end' ? 'flex-row-reverse' : ''
        } ${active ? 'font-semibold text-secondary' : 'text-gray-500 hover:text-secondary'}`}
      >
        <span>{label}</span>
        <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
          <Icon
            class={`transition-transform duration-150 ${
              active
                ? 'h-3.5 w-3.5 scale-110 text-primary'
                : 'h-3 w-3 text-gray-400 group-hover/sort:text-gray-500'
            }`}
          />
        </span>
      </button>
    </Tooltip>
  )
}
