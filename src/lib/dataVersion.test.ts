import { afterEach, describe, it, expect, vi } from 'vitest'
import { bumpData, getDataVersion, startFocusRefetch, subscribeDataVersion } from './dataVersion'

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

describe('startFocusRefetch — refetch al volver a la pestaña', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('deduplica el focus dentro de la ventana de throttle y bumpa después', () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const off = subscribeDataVersion(cb)
    const stop = startFocusRefetch(5_000) // last bump sembrado en now()=0

    // t=0: focus inmediato tras montar → dedup (las vistas ya fetchearon al montar).
    window.dispatchEvent(new Event('focus'))
    expect(cb).not.toHaveBeenCalled()

    // t=5.001: fuera de la ventana → bump de todos los dominios (1 notificación).
    vi.advanceTimersByTime(5_001)
    window.dispatchEvent(new Event('focus'))
    expect(cb).toHaveBeenCalledTimes(1)

    // t=5.001: otro focus dentro de la ventana → dedup.
    window.dispatchEvent(new Event('focus'))
    expect(cb).toHaveBeenCalledTimes(1)

    // t=10.002: visibilitychange a visible también cuenta (mismo throttle).
    vi.advanceTimersByTime(5_001)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(cb).toHaveBeenCalledTimes(2)

    off()
    stop()
  })

  it('no bumpa mientras la pestaña está oculta', () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const off = subscribeDataVersion(cb)
    const stop = startFocusRefetch(5_000)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(cb).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    vi.advanceTimersByTime(5_001)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(cb).toHaveBeenCalledTimes(1)

    off()
    stop()
  })

  it('stop() desuscribe ambos listeners (focus y visibility)', () => {
    const cb = vi.fn()
    const off = subscribeDataVersion(cb)
    const stop = startFocusRefetch(0)
    stop()

    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(cb).not.toHaveBeenCalled()

    off()
  })
})
