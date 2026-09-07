import { Check, SlidersHorizontal } from 'lucide-preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { Button } from '../ui'

export interface SectionDef {
  key: string
  label: string
}

export interface SectionState {
  key: string
  visible: boolean
}

// -- Los 8 bloques de la página de Reportes; el picker controla cuáles se muestran en pantalla y en el PDF. --
export const SECTION_DEFS: SectionDef[] = [
  { key: 'kpis', label: 'Indicadores' },
  { key: 'chart-estado', label: 'Gráfica: Distribución por estado' },
  { key: 'chart-proveedor', label: 'Gráfica: Estado × proveedor' },
  { key: 'chart-servicio', label: 'Gráfica: Por servicio' },
  { key: 'chart-meses', label: 'Gráfica: Recibidos por mes' },
  { key: 'tabla-exactas', label: 'Tabla: Cifras exactas' },
  { key: 'desglose', label: 'Desgloses: servicio y mes (solo pantalla)' },
  { key: 'calendario', label: 'Calendario de recepción (solo pantalla)' },
]

const STORAGE_KEY = 'hit-panel:reports:sections:v1'

function defaultSections(): SectionState[] {
  return SECTION_DEFS.map((s) => ({ key: s.key, visible: true }))
}

function loadSections(): SectionState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSections()
    const saved = JSON.parse(raw) as SectionState[]
    const known = new Set(SECTION_DEFS.map((s) => s.key))
    const savedKeys = new Set(saved.map((s) => s.key))
    // -- Drop keys that no longer exist, append new ones visible — same migration rule as the shipments column picker. --
    const extra = SECTION_DEFS.filter((s) => !savedKeys.has(s.key)).map((s) => ({ key: s.key, visible: true }))
    return [...saved.filter((s) => known.has(s.key)), ...extra]
  } catch {
    return defaultSections()
  }
}

/** Persisted show/hide for the report sections, kept in localStorage (per-browser, no backend). */
export function useReportSections() {
  const [sections, setSections] = useState<SectionState[]>(loadSections)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections))
  }, [sections])

  return {
    sections,
    toggle(key: string) {
      setSections((ss) => ss.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s)))
    },
    reset() {
      setSections(defaultSections())
    },
    visible(key: string) {
      return sections.find((s) => s.key === key)?.visible ?? true
    },
  }
}

/** Ghost button + popover (same interaction shape as DateRangePicker) that toggles sections live. */
export function SectionPicker({ prefs }: { prefs: ReturnType<typeof useReportSections> }) {
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

  return (
    <div class="relative" ref={boxRef}>
      <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal class="h-4 w-4" aria-hidden="true" /> Secciones
      </Button>
      {open && (
        <div class="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
          <ul class="max-h-80 overflow-y-auto scroll-thin">
            {prefs.sections.map((s) => {
              const def = SECTION_DEFS.find((d) => d.key === s.key)
              if (!def) return null
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => prefs.toggle(s.key)}
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span
                      class={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        s.visible ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'
                      }`}
                      aria-hidden="true"
                    >
                      {s.visible && <Check class="h-3 w-3" />}
                    </span>
                    {def.label}
                  </button>
                </li>
              )
            })}
          </ul>
          <div class="mt-1 border-t border-gray-100 pt-1">
            <button
              type="button"
              class="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-primary hover:bg-gray-50"
              onClick={prefs.reset}
            >
              Restablecer (mostrar todo)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
