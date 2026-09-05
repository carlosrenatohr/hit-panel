import { BarChart3, FileText, LayoutDashboard, LogOut, PackageSearch, Plug, Settings, Users } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { configApi } from '../lib/config'
import type { Role, SessionUser } from '../lib/types'
import type { View } from '../lib/router'

// `roles` (when present) restricts a nav item to those roles — billing is money, so
// it's admin/billing/staff only; viewer never sees the tab. Backend still enforces this.
const NAV: { key: View; label: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { key: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { key: 'shipments', label: 'Paquetería', icon: PackageSearch },
  { key: 'reports', label: 'Reportes', icon: BarChart3 },
  { key: 'facturacion', label: 'Facturación', icon: FileText, roles: ['admin', 'billing', 'staff'] },
  { key: 'customers', label: 'Clientes', icon: Users, roles: ['admin', 'billing', 'staff'] },
  { key: 'integraciones', label: 'Integraciones', icon: Plug },
  { key: 'configuracion', label: 'Configuración', icon: Settings, roles: ['admin', 'billing', 'staff'] },
]

// Static fallback + initial paint for the known agencies; the dynamic list comes
// from the Worker (/api/config/branding) so a new agency needs no panel change.
const BRANDS: Record<string, { logo: string; name: string }> = {
  hit: { logo: '/logo-mark.png', name: 'HIT Cargo' },
  suite: { logo: '/suite-cargo-demo-logo.png', name: 'Suite Cargo' },
  'solo-guegue': { logo: '/solo-guegue-logo.svg', name: 'Solo Guegue' },
}

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
  // Branding comes from the Worker (/api/config/branding); the static table is the
  // offline fallback and the initial paint so the shell never flashes empty.
  const [brands, setBrands] = useState<Record<string, { logo: string; name: string }>>(BRANDS)
  useEffect(() => {
    let alive = true
    configApi
      .branding()
      .then(({ agencies }) => {
        if (!alive) return
        const next = { ...BRANDS } as Record<string, { logo: string; name: string }>
        for (const a of agencies) {
          next[a.slug] = {
            logo: a.logoUrl ?? (BRANDS as Record<string, { logo: string; name: string }>)[a.slug]?.logo ?? '/logo-mark.png',
            name: a.name,
          }
        }
        setBrands(next)
      })
      .catch(() => {
        // keep static fallback; branding is cosmetic
      })
    return () => {
      alive = false
    }
  }, [])
  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role))
  const brand = brands[user.agency] ?? BRANDS.hit
  return (
    <div class="flex min-h-screen bg-neutral-bg text-gray-800">
      {/* Sidebar */}
      <aside class="hidden w-60 shrink-0 flex-col bg-navy px-4 py-5 text-white md:flex print:hidden">
        <div class="mb-8 flex items-center gap-2.5 px-2">
          <img src={brand.logo} alt={brand.name} class="h-9 w-9 object-contain" />
          <div>
            <div class="text-sm font-bold leading-tight tracking-tight">{brand.name}</div>
            <div class="text-[11px] text-gray-400">Orbit</div>
          </div>
        </div>
        <nav class="flex flex-col gap-1">
          {nav.map((n) => {
            const Icon = n.icon
            const active = view === n.key
            return (
              <button
                key={n.key}
                onClick={() => onView(n.key)}
                aria-current={active ? 'page' : undefined}
                class={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  active ? 'bg-primary text-white' : 'text-gray-300 hover:bg-navy-light hover:text-white'
                }`}
              >
                <Icon class="h-4 w-4" aria-hidden="true" />
                {n.label}
              </button>
            )
          })}
        </nav>
        <div class="mt-auto pt-4">
          <div class="border-t border-white/10 pt-4">
            <div class="px-2 text-xs text-gray-400">{user.name ?? user.email}</div>
            <div class="px-2 text-[11px] font-medium uppercase tracking-wide text-primary">{user.role}</div>
            <button
              onClick={onLogout}
              class="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-navy-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <LogOut class="h-4 w-4" aria-hidden="true" />
              Salir
            </button>
          </div>
          <a
            href="https://nativerse.space"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 flex items-center gap-2 px-2 py-2 text-gray-400 transition-colors hover:text-white"
            aria-label="Powered by Nativerse"
          >
            <span class="text-xs">Powered by:</span>
            <img src="/nativerse-logo.webp" alt="Nativerse" class="h-5 w-auto object-contain opacity-80 hover:opacity-100" />
          </a>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div class="flex flex-1 flex-col">
        <header class="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 md:hidden print:hidden">
          <div class="flex items-center gap-2 font-bold tracking-tight text-secondary">
            <img src={brand.logo} alt={brand.name} class="h-7 w-7 object-contain" />
            {brand.name}
          </div>
          <select
            class="rounded-lg border border-gray-200 px-2 py-1 text-sm"
            value={view}
            onChange={(e) => onView((e.target as HTMLSelectElement).value as View)}
          >
            {nav.map((n) => (
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

        <footer class="flex items-center justify-center gap-2 border-t border-gray-100 bg-white px-4 py-2 md:hidden print:hidden">
          <a
            href="https://nativerse.space"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Powered by Nativerse"
          >
            <span class="text-[11px]">Powered by:</span>
            <img src="/nativerse-logo.webp" alt="Nativerse" class="h-4 w-auto object-contain" />
          </a>
        </footer>
      </div>
    </div>
  )
}
