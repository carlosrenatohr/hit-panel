import { Check, ChevronDown } from 'lucide-preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { inputCls } from '../ui'

export interface MultiOption {
  value: string
  label: string
}

/**
 * Dropdown multi-select with checkboxes. Empty selection means "all" — the trigger
 * shows the resource name (placeholder) so the control reads at a glance, instead
 * of a "Todos los X" option eating the first line.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: MultiOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length <= 2
        ? selected.map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')
        : `${placeholder} (${selected.length})`

  return (
    <div class="relative" ref={boxRef}>
      <button type="button" onClick={() => setOpen((o) => !o)} class={`${inputCls} flex w-full items-center justify-between gap-2 whitespace-nowrap`}>
        <span class="truncate">{label}</span>
        <ChevronDown class="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
      </button>
      {open && (
        <div class="absolute left-0 top-full z-30 mt-1.5 w-full min-w-48 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
          <ul class="max-h-64 overflow-y-auto scroll-thin">
            {options.map((o) => {
              const on = selected.includes(o.value)
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => toggle(o.value)}
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span
                      class={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        on ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'
                      }`}
                      aria-hidden="true"
                    >
                      {on && <Check class="h-3 w-3" />}
                    </span>
                    <span class="truncate">{o.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {selected.length > 0 && (
            <div class="mt-1 border-t border-gray-100 pt-1">
              <button
                type="button"
                class="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-gray-50"
                onClick={() => onChange([])}
              >
                Ver todos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
