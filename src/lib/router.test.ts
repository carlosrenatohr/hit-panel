import { describe, expect, it } from 'vitest'
import { navigate, parseRoute, pathFor } from './router'

describe('router', () => {
  it('maps every view to a real path', () => {
    expect(pathFor('overview')).toBe('/')
    expect(pathFor('shipments')).toBe('/envios')
    expect(pathFor('reports')).toBe('/reportes')
    expect(pathFor('facturacion')).toBe('/facturacion')
    expect(pathFor('customers')).toBe('/clientes')
    expect(pathFor('integraciones')).toBe('/integraciones')
    expect(pathFor('configuracion')).toBe('/configuracion')
  })

  it('encodes the detail guia into /envio/:guia and back', () => {
    const guia = '123-456/ABC'
    expect(pathFor('shipments', guia)).toBe(`/envio/${encodeURIComponent(guia)}`)
    expect(parseRoute(`/envio/${encodeURIComponent(guia)}`)).toEqual({ view: 'shipments', guia })
  })

  it('parses unknown paths as overview', () => {
    expect(parseRoute('/whatever')).toEqual({ view: 'overview', guia: null })
    expect(parseRoute('/')).toEqual({ view: 'overview', guia: null })
  })

  it('navigate() pushes state and notifies the route listener', () => {
    const seen: string[] = []
    window.addEventListener('popstate', () => seen.push(window.location.pathname))
    navigate({ view: 'configuracion' })
    expect(window.location.pathname).toBe('/configuracion')
    expect(seen).toEqual(['/configuracion'])
    window.history.back()
  })
})
