import { Anchor, GripVertical, Package, Plane, Scale, Search, SlidersHorizontal, Trophy, Users, X } from 'lucide-preact'
import { useState } from 'preact/hooks'
import type { CustomerAggregateStats } from '../lib/customer'
import { fmtLbs } from '../lib/format'
import { MAX_VISIBLE_CARDS, capCards } from '../lib/cards'
import { Button, Card, IconButton, inputCls } from './ui'

interface CardDef {
  key: string
  label: string
  icon: typeof Scale
  render: (s: CustomerAggregateStats) => string | null
}

const CARD_DEFS: CardDef[] = [
  { key: 'librasTotal', label: 'Peso total registrado', icon: Scale, render: (s) => fmtLbs(s.totalWeightLb) },
  { key: 'librasMaritimo', label: 'Peso marítimo registrado', icon: Anchor, render: (s) => fmtLbs(s.weightMaritimo) },
  { key: 'librasAereo', label: 'Peso aéreo registrado', icon: Plane, render: (s) => fmtLbs(s.weightAereo) },
  { key: 'paquetesTotal', label: 'Paquetes registrados', icon: Package, render: (s) => String(s.packageCountTotal) },
  { key: 'paquetesMaritimo', label: 'Paquetes marítimos', icon: Anchor, render: (s) => String(s.packageCountMaritimo) },
  { key: 'paquetesAereo', label: 'Paquetes aéreos', icon: Plane, render: (s) => String(s.packageCountAereo) },
]

export const ALL_CARD_OPTIONS = [
  ...CARD_DEFS.map((d) => ({ key: d.key, label: d.label })),
  { key: 'topMaritimo', label: 'Cliente #1 marítimo (todos los paquetes)' },
  { key: 'topAereo', label: 'Cliente #1 aéreo (todos los paquetes)' },
  { key: 'topBillingMaritimo', label: 'Cliente #1 marítimo (solo facturado)' },
  { key: 'topBillingAereo', label: 'Cliente #1 aéreo (solo facturado)' },
]

export const DEFAULT_CARD_HIDDEN = new Set(['paquetesMaritimo', 'paquetesAereo'])
export const CARD_STORAGE_KEY = 'hit-panel:customers:cards:v1'

export function loadCardHidden(): string[] {
  try {
    const raw = localStorage.getItem(CARD_STORAGE_KEY)
    if (!raw) return [...DEFAULT_CARD_HIDDEN]
    const saved = JSON.parse(raw) as string[]
    const known = new Set(ALL_CARD_OPTIONS.map((o) => o.key))
    return saved.filter((v) => known.has(v))
  } catch {
    return [...DEFAULT_CARD_HIDDEN]
  }
}

function TopClientCard({ title, top, onViewClient }: { title: string; top: { name: string; weightLb: number } | null; onViewClient: (name: string) => void }) {
  return (
    <Card class="flex flex-col p-4">
      <div class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
        <Trophy class="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </div>
      {top ? (
        <>
          <button type="button" onClick={() => onViewClient(top.name)} aria-label={`Ver paquetes de ${top.name} en Envíos`} class="mt-1.5 truncate text-left text-sm font-semibold text-primary hover:underline" title={`Ver paquetes de ${top.name} en Envíos`}>
            {top.name}
          </button>
          <div class="mt-0.5 text-lg font-bold tabular-nums text-gray-800">{fmtLbs(top.weightLb)}</div>
        </>
      ) : (
        <div class="mt-1.5 text-sm text-gray-400">Sin movimientos en el rango.</div>
      )}
    </Card>
  )
}

export function CardPickerModal({ onClose, hidden, onApply }: { onClose: () => void; hidden: string[]; onApply: (next: string[]) => void }) {
  const [draft, setDraft] = useState<string[]>(hidden)
  const [search, setSearch] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const visibleCount = ALL_CARD_OPTIONS.length - draft.length
  const atMax = visibleCount >= MAX_VISIBLE_CARDS

  function toggleDraft(key: string) {
    setDraft((prev) => {
      const isHidden = prev.includes(key)
      // Checking a box shows the card (removes from hidden). Only block SHOWING
      // beyond the max — unchecking (hiding) is always allowed.
      if (isHidden && ALL_CARD_OPTIONS.length - prev.length >= MAX_VISIBLE_CARDS) return prev
      return isHidden ? prev.filter((k) => k !== key) : [...prev, key]
    })
  }

  function reorderDraft(from: number, to: number) {
    setDraft((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const q = search.trim().toLowerCase()
  const filtered = ALL_CARD_OPTIONS.filter((c) => !q || c.label.toLowerCase().includes(q))

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div class="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div class="border-b border-gray-100 p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-secondary">Personalizar tarjetas</h2>
            <IconButton label="Cerrar" onClick={onClose}>
              <X class="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </div>
          <p class="mt-0.5 text-xs text-gray-500">Elegí qué tarjetas se muestran en el resumen. Se muestran máximo {MAX_VISIBLE_CARDS}.</p>
        </div>

        <div class="p-3">
          <div class="relative mb-2">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              class={`${inputCls} w-full pl-8 text-sm`}
              placeholder="Buscar tarjeta…"
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="mb-2 flex items-center justify-between rounded-lg bg-primary/5 px-2 py-1.5">
            <span class="text-xs font-medium text-primary">Visibles: {visibleCount}/{MAX_VISIBLE_CARDS}</span>
            {atMax && <span class="text-xs text-gray-500">Límite alcanzado — ocultá una para mostrar otra.</span>}
          </div>

          <div class="scroll-thin max-h-72 overflow-y-auto">
            <ul>
              {filtered.map((c, i) => {
                const checked = !draft.includes(c.key)
                return (
                  <li
                    key={c.key}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== i) reorderDraft(dragIdx, i)
                      setDragIdx(null)
                    }}
                    class="flex cursor-grab items-center gap-2 rounded-lg px-2 py-2 active:cursor-grabbing hover:bg-gray-50"
                  >
                    <GripVertical class="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
                    <label class={`flex flex-1 items-center gap-2 text-sm ${!checked && atMax ? 'cursor-not-allowed text-gray-400' : 'text-gray-700'}`}>
                      <input type="checkbox" checked={checked} disabled={!checked && atMax} onChange={() => toggleDraft(c.key)} />
                      {c.label}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-gray-100 p-3">
          <button type="button" class="text-xs font-medium text-primary hover:underline" onClick={() => setDraft([...DEFAULT_CARD_HIDDEN])}>
            Restablecer
          </button>
          <div class="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => { onApply(draft); onClose() }}>Guardar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CustomerCards({ stats, onViewClient, hidden, onApply }: { stats: CustomerAggregateStats; onViewClient: (name: string) => void; hidden: string[]; onApply: (next: string[]) => void }) {
  const metricCards = CARD_DEFS.filter((d) => !hidden.includes(d.key))
  const topCards: Array<{ key: string; title: string; top: { name: string; weightLb: number } | null }> = [
    { key: 'topMaritimo', title: 'Cliente #1 marítimo (todos)', top: stats.topMaritimo },
    { key: 'topAereo', title: 'Cliente #1 aéreo (todos)', top: stats.topAereo },
    { key: 'topBillingMaritimo', title: 'Cliente #1 marítimo (facturado)', top: stats.topBillingMaritimo },
    { key: 'topBillingAereo', title: 'Cliente #1 aéreo (facturado)', top: stats.topBillingAereo },
  ].filter((c) => !hidden.includes(c.key))
  const visible = capCards([...metricCards, ...topCards])

  return (
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <span class="flex items-center gap-1.5 text-xs font-medium text-gray-400">
          <Users class="h-3.5 w-3.5" aria-hidden="true" /> Resumen del rango
        </span>
      </div>
      <div class="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {visible.map((d) => {
          if ('render' in d) {
            const Icon = d.icon
            const value = d.render(stats)
            return (
              <Card key={d.key} class="flex items-center gap-3 p-4">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon class="h-4 w-4" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <div class="truncate text-xs text-gray-400">{d.label}</div>
                  <div class="truncate text-lg font-bold tabular-nums text-gray-800">{value}</div>
                </div>
              </Card>
            )
          }
          return <TopClientCard key={d.key} title={d.title} top={d.top} onViewClient={onViewClient} />
        })}
      </div>
    </div>
  )
}
