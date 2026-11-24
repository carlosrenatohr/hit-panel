import { ChevronLeft, ChevronRight } from 'lucide-preact'

/** Allowed page sizes. 20 is the product default; 100 is the hard ceiling. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 20

function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const keep = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

const navBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-35'

/**
 * The one footer every resource list uses: "Mostrando 1–20 de 358", the page
 * size selector (10/20/50/100, default 20) and the pager. It renders nothing
 * for an empty result set — the caller's empty state already says why.
 */
export function Pagination({
  page,
  count,
  pageSize,
  onPageChange,
  onPageSizeChange,
  noun = 'resultados',
  disabled = false,
}: {
  page: number
  count: number
  pageSize: PageSize
  onPageChange: (p: number) => void
  onPageSizeChange: (size: PageSize) => void
  /** Plural noun for the range sentence ("resultados", "facturas", "clientes"). */
  noun?: string
  disabled?: boolean
}) {
  if (count <= 0) return null
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const start = (current - 1) * pageSize + 1
  const end = Math.min(count, current * pageSize)

  return (
    <div class="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p class="text-gray-500" aria-live="polite">
          Mostrando{' '}
          <span class="font-medium tabular-nums text-gray-700">
            {start}–{end}
          </span>{' '}
          de <span class="font-medium tabular-nums text-gray-700">{count}</span> {noun}
        </p>
        <label class="flex items-center gap-1.5 text-gray-500">
          <span class="whitespace-nowrap">Filas por página</span>
          <select
            class="rounded-lg border border-gray-200 bg-white py-1 pl-2 pr-6 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={pageSize}
            disabled={disabled}
            aria-label="Filas por página"
            onChange={(e) => onPageSizeChange(Number((e.target as HTMLSelectElement).value) as PageSize)}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav class="flex items-center justify-between gap-1 sm:justify-end" aria-label="Paginación">
        <span class="tabular-nums text-gray-400 sm:hidden">
          Página {current} de {totalPages}
        </span>
        <div class="flex items-center gap-1">
          <button type="button" class={navBtn} disabled={disabled || current <= 1} onClick={() => onPageChange(current - 1)} aria-label="Página anterior">
            <ChevronLeft class="h-4 w-4" aria-hidden="true" />
          </button>
          <div class="hidden items-center gap-1 sm:flex">
            {pageWindow(current, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} class="px-1 text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  disabled={disabled}
                  aria-current={p === current ? 'page' : undefined}
                  class={`h-8 min-w-[2rem] rounded-lg px-2 text-center text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    p === current ? 'bg-primary font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <button type="button" class={navBtn} disabled={disabled || current >= totalPages} onClick={() => onPageChange(current + 1)} aria-label="Página siguiente">
            <ChevronRight class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  )
}
