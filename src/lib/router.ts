import { useEffect, useState } from 'preact/hooks'

export type View = 'overview' | 'shipments' | 'reports' | 'facturacion' | 'customers' | 'integraciones' | 'configuracion'

export interface Location {
  view: View
  guia: string | null
}

const VIEW_PATHS: Record<View, string> = {
  overview: '/',
  shipments: '/envios',
  reports: '/reportes',
  facturacion: '/facturacion',
  customers: '/clientes',
  integraciones: '/integraciones',
  configuracion: '/configuracion',
}

export function pathFor(view: View, guia?: string | null): string {
  return guia ? `/envio/${encodeURIComponent(guia)}` : VIEW_PATHS[view]
}

export function parseRoute(pathname: string): Location {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 2 && parts[0] === 'envio') {
    return { view: 'shipments', guia: decodeURIComponent(parts[1]) }
  }
  const view = (Object.keys(VIEW_PATHS) as View[]).find((v) => VIEW_PATHS[v] === pathname)
  return { view: view ?? 'overview', guia: null }
}

export function navigate(to: { view: View; guia?: string | null }): void {
  const path = pathFor(to.view, to.guia)
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  // The router listens on popstate; a manual push must surface the same event.
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** Live view/detail derived from location.pathname (History API). */
export function useRoute(): Location {
  const [loc, setLoc] = useState<Location>(() => parseRoute(window.location.pathname))
  useEffect(() => {
    const onPop = () => setLoc(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return loc
}
