import { describe, it, expect, vi, beforeEach } from 'vitest'

// PostgREST rejects a request with two `or=` params (PGRST100), so the list
// filter must always emit a single `or`. This test records the builder calls
// instead of hitting the network.
const log = vi.hoisted(() => ({ calls: [] as Array<{ m: string; args: unknown[] }> }))

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
  return { database: { from: () => make() } }
})

vi.mock('@insforge/sdk', () => ({ createClient: () => client }))
vi.mock('./customer', () => ({
  customerApi: { list: vi.fn().mockResolvedValue({ rows: [{ id: 'c1' }], count: 1 }) },
}))

import { listPackages } from './insforge'

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
