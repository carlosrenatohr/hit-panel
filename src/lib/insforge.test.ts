import { describe, it, expect, vi, beforeEach } from 'vitest'

// PostgREST rejects a request with two `or=` params (PGRST100), so the list
// filter must always emit a single `or`. This test records the builder calls
// instead of hitting the network.
const log = vi.hoisted(() => ({ calls: [] as Array<{ m: string; args: unknown[] }> }))
const rpc = vi.hoisted(() => ({ result: { data: null, error: null } as { data: unknown; error: unknown } }))

const client = vi.hoisted(() => {
  const make = (): any =>
    new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === 'then') return (resolve: (v: unknown) => unknown) => resolve({ data: [], count: 0, error: null })
          return (...args: unknown[]) => {
            log.calls.push({ m: prop, args })
            return make()
          }
        },
      },
    )
  return { database: { from: () => make(), rpc: () => Promise.resolve(rpc.result) } }
})

vi.mock('@insforge/sdk', () => ({ createClient: () => client }))
vi.mock('./customer', () => ({
  customerApi: { list: vi.fn().mockResolvedValue({ rows: [{ id: 'c1' }], count: 1 }) },
}))

import { createPackage, listPackages } from './insforge'

const callsOf = (method: string) => log.calls.filter((c) => c.m === method)

describe('listPackages tariff-kind filter', () => {
  beforeEach(() => {
    log.calls.length = 0
  })

  it('merges weight and search into ONE or expression', async () => {
    await listPackages({ search: 'ana', pricingKind: 'weight', pageSize: 1 })
    const ors = callsOf('or')
    expect(ors).toHaveLength(1)
    const expr = String(ors[0].args[0])
    expect(expr).toContain('and(or(')
    expect(expr).toContain('pricing_kind.is.null')
    expect(expr).toContain('pricing_kind.eq.weight')
    expect(expr).toContain('client_id.in.(c1)')
  })

  it('uses a single plain or for weight without search', async () => {
    await listPackages({ pricingKind: 'weight', pageSize: 1 })
    expect(callsOf('or')).toHaveLength(1)
    expect(String(callsOf('or')[0].args[0])).toBe('pricing_kind.eq.weight,pricing_kind.is.null')
  })

  it('keeps a fixed kind as an equality next to the search or', async () => {
    await listPackages({ search: 'ana', pricingKind: 'fixed', pageSize: 1 })
    expect(callsOf('or')).toHaveLength(1)
    expect(String(callsOf('or')[0].args[0])).not.toContain('pricing_kind')
    const kinds = callsOf('eq').filter((c) => c.args[0] === 'pricing_kind')
    expect(kinds).toHaveLength(1)
    expect(kinds[0].args[1]).toBe('fixed')
  })
})

describe('createPackage RPC errors', () => {
  beforeEach(() => {
    rpc.result = { data: null, error: null }
  })

  // PostgREST errors are plain objects, so the form used to show the generic
  // "Error al crear el paquete." instead of the cause.
  it('surfaces a 42P10 as an actionable message', async () => {
    rpc.result = {
      data: null,
      error: { code: '42P10', message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' },
    }
    await expect(createPackage({ almacenId: 'G-1' })).rejects.toThrow(/42P10/)
  })

  it('keeps the database message for any other RPC failure', async () => {
    rpc.result = { data: null, error: { code: 'P0001', message: 'client is required' } }
    await expect(createPackage({ almacenId: 'G-1' })).rejects.toThrow('client is required')
  })
})
