import { describe, it, expect, vi } from 'vitest'
import { bumpData, getDataVersion, subscribeDataVersion } from './dataVersion'

// Per-file module isolation (vitest default) gives this file a fresh bus.
describe('dataVersion bus', () => {
  it('starts at 0 and bumps per domain', () => {
    expect(getDataVersion('packages')).toBe(0)
    expect(getDataVersion('clients')).toBe(0)
    expect(getDataVersion('invoices')).toBe(0)

    bumpData('packages')
    expect(getDataVersion('packages')).toBe(1)
    expect(getDataVersion('clients')).toBe(0)

    bumpData('packages', 'clients')
    expect(getDataVersion('packages')).toBe(2)
    expect(getDataVersion('clients')).toBe(1)
    expect(getDataVersion('invoices')).toBe(0)
  })

  it('notifies subscribers and unsubscribes cleanly', () => {
    const cb = vi.fn()
    const off = subscribeDataVersion(cb)

    bumpData('invoices')
    expect(cb).toHaveBeenCalledTimes(1)

    off()
    bumpData('invoices')
    expect(cb).toHaveBeenCalledTimes(1)
  })
})