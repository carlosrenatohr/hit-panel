import { useEffect, useRef, useState } from 'preact/hooks'
import { Search, UserPlus, X } from 'lucide-preact'
import { customerApi, type Customer } from '../../lib/customer'
import { inputCls } from '../ui'

interface Props {
  value: string
  onSelect: (client: Customer) => void
  onClear?: () => void
  allowCreate?: boolean
  placeholder?: string
  disabled?: boolean
  class?: string
}

/**
 * Reusable autocomplete for billing clients. Debounced search by name,
 * shows results with casillero, and optionally allows inline creation
 * when no match is found.
 *
 * allowCreate = true  → manual package creation (panel needs to pick or create a client)
 * allowCreate = false → rate assignment, invoice filters (pick only, no creation)
 */
export default function ClientSearch({
  value,
  onSelect,
  onClear,
  allowCreate = false,
  placeholder = 'Buscar cliente…',
  disabled = false,
  class: cls = '',
}: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Keep internal query in sync when parent changes value.
  useEffect(() => { setQuery(value) }, [value])

  // Debounced search.
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const { rows } = await customerApi.list({ search: query.trim(), pageSize: 8 })
        setResults(rows)
        setOpen(true)
        setHighlight(0)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(c: Customer) {
    onSelect(c)
    setQuery(c.name)
    setOpen(false)
  }

  function createAndSelect() {
    const name = query.trim()
    if (!name) return
    // Build a minimal Customer-like object; the caller will persist via API.
    onSelect({ id: '', name, nameNormalized: name.toLowerCase(), casillero: null, toReview: false, email: null, phone: null, address: null, defaultRateId: null })
    setOpen(false)
  }

  function clear() {
    setQuery('')
    setResults([])
    setOpen(false)
    onClear?.()
    inputRef.current?.focus()
  }

  const exactMatch = results.some((c) => c.nameNormalized === query.trim().toLowerCase())

  return (
    <div ref={boxRef} class={`relative ${cls}`}>
      <div class="relative">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          ref={inputRef}
          class={`${inputCls} w-full pl-8 pr-7`}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onFocus={() => { if (results.length) setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1 + (allowCreate && !exactMatch ? 1 : 0))) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
            else if (e.key === 'Enter') {
              e.preventDefault()
              if (highlight < results.length) select(results[highlight])
              else if (allowCreate && !exactMatch) createAndSelect()
            }
            else if (e.key === 'Escape') setOpen(false)
          }}
        />
        {query && (
          <button type="button" onClick={clear} class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Limpiar">
            <X class="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (results.length > 0 || (allowCreate && query.trim() && !exactMatch)) && (
        <ul class="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg" role="listbox">
          {results.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === highlight}
              class={`flex cursor-pointer items-center justify-between px-3 py-2 ${i === highlight ? 'bg-primary/10' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); select(c) }}
            >
              <span class="font-medium text-secondary">{c.name}</span>
              {c.casillero && <span class="text-xs text-gray-400">#{c.casillero}</span>}
            </li>
          ))}
          {allowCreate && query.trim() && !exactMatch && (
            <li
              role="option"
              aria-selected={highlight === results.length}
              class={`flex cursor-pointer items-center gap-2 px-3 py-2 text-primary ${highlight === results.length ? 'bg-primary/10' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setHighlight(results.length)}
              onMouseDown={(e) => { e.preventDefault(); createAndSelect() }}
            >
              <UserPlus class="h-3.5 w-3.5" />
              <span>Crear cliente: <strong>{query.trim()}</strong></span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
