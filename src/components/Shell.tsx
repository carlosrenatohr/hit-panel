import { BarChart3, LayoutDashboard, LogOut, Package, PackageSearch } from 'lucide-preact'
import type { ComponentChildren } from 'preact'
import type { SessionUser } from '../lib/types'
import type { View } from './App'

const NAV: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { key: 'shipments', label: 'Envíos', icon: PackageSearch },
  { key: 'reports', label: 'Reportes', icon: BarChart3 },
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
    <div class="flex min-h-screen bg-neutral-bg text-gray-800">
      {/* Sidebar */}
      <aside class="hidden w-60 shrink-0 flex-col bg-secondary px-4 py-5 text-white md:flex">
        <div class="mb-8 flex items-center gap-2.5 px-2">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Package class="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <div>
            <div class="text-sm font-bold leading-tight tracking-tight">HIT Cargo</div>
            <div class="text-[11px] text-gray-400">Panel interno</div>
          </div>
        </div>
        <nav class="flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon
            const active = view === n.key
            return (
              <button
                key={n.key}
                onClick={() => onView(n.key)}
                aria-current={active ? 'page' : undefined}
                class={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  active ? 'bg-primary text-white' : 'text-gray-300 hover:bg-secondary-light hover:text-white'
                }`}
              >
                <Icon class="h-4 w-4" aria-hidden="true" />
                {n.label}
              </button>
            )
          })}
        </nav>
        <div class="mt-auto border-t border-white/10 pt-4">
          <div class="px-2 text-xs text-gray-400">{user.name ?? user.email}</div>
          <div class="px-2 text-[11px] font-medium uppercase tracking-wide text-primary">{user.role}</div>
          <button
            onClick={onLogout}
            class="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-secondary-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <LogOut class="h-4 w-4" aria-hidden="true" />
            Salir
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div class="flex flex-1 flex-col">
        <header class="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 md:hidden">
          <div class="flex items-center gap-2 font-bold tracking-tight text-secondary">
            <span class="flex h-7 w-7 items-center justify-center rounded bg-primary">
              <Package class="h-4 w-4 text-white" aria-hidden="true" />
            </span>
            HIT Panel
          </div>
          <select
            class="rounded-lg border border-gray-200 px-2 py-1 text-sm"
            value={view}
            onChange={(e) => onView((e.target as HTMLSelectElement).value as View)}
          >
            {NAV.map((n) => (
              <option key={n.key} value={n.key}>
                {n.label}
              </option>
            ))}
          </select>
          <button onClick={onLogout} class="text-sm text-gray-500">
            Salir
          </button>
        </header>

        <main class="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
