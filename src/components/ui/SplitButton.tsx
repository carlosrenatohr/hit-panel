import { ChevronDown } from 'lucide-preact'
import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

export interface SplitButtonItem {
  label: string
  icon?: ComponentChildren
  onClick: () => void
}

/**
 * GitHub-style split button: the primary action is the wide half, secondary
 * actions live in the dropdown behind the chevron. Same visual unit, one
 * rounded box.
 */
export function SplitButton({
  primaryLabel,
  primaryIcon,
  primaryOnClick,
  items,
  disabled = false,
}: {
  primaryLabel: string
  primaryIcon?: ComponentChildren
  primaryOnClick: () => void
  items: SplitButtonItem[]
  disabled?: boolean
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

  const btnBase =
    'inline-flex items-center justify-center gap-1.5 bg-primary text-white shadow-sm transition-colors hover:bg-primary-dark hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50'

  return (
    <div class="relative inline-flex" ref={boxRef}>
      <button type="button" onClick={primaryOnClick} disabled={disabled} class={`${btnBase} rounded-l-lg rounded-r-none px-3 py-2 text-sm font-medium`}>
        {primaryIcon}
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label="Más opciones"
        aria-expanded={open}
        class={`${btnBase} rounded-r-lg rounded-l-none border-l border-white/25 px-2 py-2`}
      >
        <ChevronDown class="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div class="absolute right-0 top-full z-30 mt-1.5 w-48 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
          <ul>
            {items.map((it) => (
              <li key={it.label}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    it.onClick()
                  }}
                  class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  {it.icon}
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
