import type { ComponentChildren } from 'preact'
import type { SessionUser } from '../lib/types'
import type { View } from './App'

const NAV: { key: View; label: string; icon: string }[] = [
  { key: 'overview', label: 'Resumen', icon: '📊' },
  { key: 'shipments', label: 'Envíos', icon: '📦' },
  { key: 'reports', label: 'Reportes', icon: '📈' },
]

export default function Shell({
  user,
  view,
  onView,
  onLogout,
  children,
}: {
  user: SessionUser
  view: View
  onView: (v: View) => void
  onLogout: () => void
  children: ComponentChildren
}) {
  return (
    <div class="flex min-h-screen bg-neutral-bg text-slate-800">
      {/* Sidebar */}
      <aside class="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-secondary px-4 py-5 text-white md:flex">
        <div class="mb-8 flex items-center gap-2 px-2">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg">📦</span>
          <div>
            <div class="text-sm font-bold leading-tight">HIT Cargo</div>
            <div class="text-[11px] text-slate-400">Panel interno</div>
          </div>
        </div>
        <nav class="flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => onView(n.key)}
              class={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                view === n.key ? 'bg-primary text-white' : 'text-slate-300 hover:bg-secondary-light'
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div class="mt-auto border-t border-white/10 pt-4">
          <div class="px-2 text-xs text-slate-400">{user.name ?? user.email}</div>
          <div class="px-2 text-[11px] uppercase tracking-wide text-primary">{user.role}</div>
          <button
            onClick={onLogout}
            class="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-secondary-light"
          >
            ↩︎ Salir
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div class="flex flex-1 flex-col">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div class="flex items-center gap-2 font-bold text-secondary">
            <span class="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm">📦</span> HIT Panel
          </div>
          <select
            class="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            value={view}
            onChange={(e) => onView((e.target as HTMLSelectElement).value as View)}
          >
            {NAV.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
          <button onClick={onLogout} class="text-sm text-slate-500">
            Salir
          </button>
        </header>

        <main class="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
