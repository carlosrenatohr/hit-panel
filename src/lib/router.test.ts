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

  it('carries a ?cliente= seed into /envios and parses it back', () => {
    expect(pathFor('shipments', null, 'Ana María')).toBe(`/envios?cliente=${encodeURIComponent('Ana María')}`)
    expect(parseRoute(`/envios?cliente=${encodeURIComponent('Ana María')}`)).toEqual({ view: 'shipments', guia: null, cliente: 'Ana María', unassigned: false, estado: null })
    expect(parseRoute('/envios')).toEqual({ view: 'shipments', guia: null, cliente: null, unassigned: false, estado: null })
  })

  it('carries an unassigned=1 query param', () => {
    expect(pathFor('shipments', null, null, true)).toBe('/envios?unassigned=1')
    expect(parseRoute('/envios?unassigned=1')).toEqual({ view: 'shipments', guia: null, cliente: null, unassigned: true, estado: null })
    expect(parseRoute('/envios?cliente=X&unassigned=1')).toEqual({ view: 'shipments', guia: null, cliente: 'X', unassigned: true, estado: null })
  })

  it('carries an estado= status seed into /envios and parses it back', () => {
    expect(pathFor('shipments', null, null, false, 'excepcion')).toBe('/envios?estado=excepcion')
    expect(pathFor('shipments', null, 'Ana', true, 'en_destino')).toBe('/envios?cliente=Ana&unassigned=1&estado=en_destino')
    expect(parseRoute('/envios?estado=en_destino')).toEqual({ view: 'shipments', guia: null, cliente: null, unassigned: false, estado: 'en_destino' })
    expect(parseRoute('/envios?cliente=X&estado=excepcion')).toEqual({ view: 'shipments', guia: null, cliente: 'X', unassigned: false, estado: 'excepcion' })
  })

  it('encodes the detail guia into /envio/:guia and back', () => {
    const guia = '123-456/ABC'
    expect(pathFor('shipments', guia)).toBe(`/envio/${encodeURIComponent(guia)}`)
    expect(parseRoute(`/envio/${encodeURIComponent(guia)}`)).toEqual({ view: 'shipments', guia, cliente: null, unassigned: false, estado: null })
  })

  it('parses unknown paths as overview', () => {
    expect(parseRoute('/whatever')).toEqual({ view: 'overview', guia: null, cliente: null, unassigned: false, estado: null })
    expect(parseRoute('/')).toEqual({ view: 'overview', guia: null, cliente: null, unassigned: false, estado: null })
  })

  it('falls back to overview on invalid percent-encoding in /envio/:guia', () => {
    expect(parseRoute('/envio/%zz')).toEqual({ view: 'overview', guia: null, cliente: null, unassigned: false, estado: null })
    expect(parseRoute('/envio/%E0%A4%A')).toEqual({ view: 'overview', guia: null, cliente: null, unassigned: false, estado: null })
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
