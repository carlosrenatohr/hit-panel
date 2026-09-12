import { useEffect, useState } from 'preact/hooks'

export type View = 'overview' | 'shipments' | 'reports' | 'facturacion' | 'customers' | 'integraciones' | 'configuracion'

export interface Location {
  view: View
  guia: string | null
  /** Client name carried into Envíos to seed its search filter (from the Clientes cards). */
  cliente: string | null
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

export function pathFor(view: View, guia?: string | null, cliente?: string | null): string {
  if (guia) return `/envio/${encodeURIComponent(guia)}`
  const base = VIEW_PATHS[view]
  return cliente ? `${base}?cliente=${encodeURIComponent(cliente)}` : base
}

export function parseRoute(pathname: string): Location {
  const [rawPath, rawQuery] = pathname.split('?')
  const parts = rawPath.split('/').filter(Boolean)
  const cliente = rawQuery ? new URLSearchParams(rawQuery).get('cliente') : null
  if (parts.length === 2 && parts[0] === 'envio') {
    try {
      return { view: 'shipments', guia: decodeURIComponent(parts[1]), cliente }
    } catch {
      return { view: 'overview', guia: null, cliente: null }
    }
  }
  const view = (Object.keys(VIEW_PATHS) as View[]).find((v) => VIEW_PATHS[v] === rawPath)
  return { view: view ?? 'overview', guia: null, cliente }
}

export function navigate(to: { view: View; guia?: string | null; cliente?: string | null }): void {
  const path = pathFor(to.view, to.guia, to.cliente)
  if (window.location.pathname + window.location.search === path) return
  window.history.pushState({}, '', path)
  // The router listens on popstate; a manual push must surface the same event.
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** Live view/detail derived from location.pathname (History API). */
export function useRoute(): Location {
  const [loc, setLoc] = useState<Location>(() => parseRoute(window.location.pathname + window.location.search))
  useEffect(() => {
    const onPop = () => setLoc(parseRoute(window.location.pathname + window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return loc
}