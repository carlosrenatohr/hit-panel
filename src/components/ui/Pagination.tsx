import { ChevronLeft, ChevronRight } from 'lucide-preact'

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

export function Pagination({
  page,
  totalPages,
  count,
  onPageChange,
}: {
  page: number
  totalPages: number
  count: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div class="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-sm">
      <span class="hidden shrink-0 text-gray-500 sm:block">
        {count} resultados · pág. {page}/{totalPages}
      </span>
      <nav class="flex flex-1 items-center justify-end gap-1" aria-label="Paginación">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Anterior"
          class="rounded-lg px-2 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronLeft class="h-4 w-4" aria-hidden="true" />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} class="px-1.5 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              class={`min-w-[2rem] rounded-lg px-2 py-1.5 text-center tabular-nums transition-colors ${
                p === page ? 'bg-primary font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label="Siguiente"
          class="rounded-lg px-2 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ChevronRight class="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  )
}
