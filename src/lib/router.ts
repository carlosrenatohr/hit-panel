import { useEffect, useState } from 'preact/hooks'

export type View = 'overview' | 'shipments' | 'reports' | 'facturacion' | 'customers' | 'integraciones' | 'configuracion'

export interface Location {
  view: View
  guia: string | null
  /** Client name carried into Envíos to seed its search filter (from the Clientes cards). */
  cliente: string | null
  /** When true, Envíos shows only packages without a client assigned. */
  unassigned: boolean
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

export function pathFor(view: View, guia?: string | null, cliente?: string | null, unassigned?: boolean): string {
  if (guia) return `/envio/${encodeURIComponent(guia)}`
  const base = VIEW_PATHS[view]
  const parts: string[] = []
  if (cliente) parts.push(`cliente=${encodeURIComponent(cliente)}`)
  if (unassigned) parts.push('unassigned=1')
  return parts.length ? `${base}?${parts.join('&')}` : base
}

export function parseRoute(pathname: string): Location {
  const [rawPath, rawQuery] = pathname.split('?')
  const parts = rawPath.split('/').filter(Boolean)
  const params = rawQuery ? new URLSearchParams(rawQuery) : new URLSearchParams()
  const cliente = params.get('cliente')
  const unassigned = params.get('unassigned') === '1'
  if (parts.length === 2 && parts[0] === 'envio') {
    try {
      return { view: 'shipments', guia: decodeURIComponent(parts[1]), cliente, unassigned }
    } catch {
      return { view: 'overview', guia: null, cliente: null, unassigned: false }
    }
  }
  const view = (Object.keys(VIEW_PATHS) as View[]).find((v) => VIEW_PATHS[v] === rawPath)
  return { view: view ?? 'overview', guia: null, cliente, unassigned }
}

export function navigate(to: { view: View; guia?: string | null; cliente?: string | null; unassigned?: boolean }): void {
  const path = pathFor(to.view, to.guia, to.cliente, to.unassigned)
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