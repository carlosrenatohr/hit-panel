import { afterEach, describe, it, expect, vi } from 'vitest'
import { useEffect } from 'preact/hooks'
import { render, screen, waitFor, act } from '@testing-library/preact'
import {
  bumpData,
  bumpList,
  getDataFreshnessAge,
  getDataVersion,
  getCounterVersion,
  markDataFresh,
  startFocusRefetch,
  subscribeDataVersion,
  useCounterVersion,
  useDataVersion,
  useFetchGate,
} from './dataVersion'

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

  it('bumpList refresca el cuerpo pero deja los contadores quietos', () => {
    const bodyBefore = getDataVersion('packages')
    const countersBefore = getCounterVersion('packages')

    bumpList('packages')
    expect(getDataVersion('packages')).toBe(bodyBefore + 1)
    expect(getCounterVersion('packages')).toBe(countersBefore)

    bumpData('packages')
    expect(getDataVersion('packages')).toBe(bodyBefore + 2)
    expect(getCounterVersion('packages')).toBe(countersBefore + 1)
  })

  it('los suscriptores de contadores no reaccionan a bumpList', () => {
    function Probe() {
      const body = useDataVersion('packages')
      const counters = useCounterVersion('packages')
      return (
        <span data-testid="probe">
          {body}:{counters}
        </span>
      )
    }
    // El bus es estado de módulo compartido en el archivo → asserts relativos.
    const body0 = getDataVersion('packages')
    const counters0 = getCounterVersion('packages')
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe(`${body0}:${counters0}`)

    act(() => bumpList('packages'))
    expect(screen.getByTestId('probe').textContent).toBe(`${body0 + 1}:${counters0}`)

    act(() => bumpData('packages'))
    expect(screen.getByTestId('probe').textContent).toBe(`${body0 + 2}:${counters0 + 1}`)
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
    // staleMs=0 desactiva la ventana de frescura (los tests controlan la data).
    const stop = startFocusRefetch(5_000, 0) // last bump sembrado en now()=0

    // t=0: focus inmediato tras montar → dedup (las vistas ya fetchearon al montar).
    window.dispatchEvent(new Event('focus'))
    expect(cb).not.toHaveBeenCalled()

    // t=5.001: fuera de la ventana → bump de la capa cuerpo (1 notificación).
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
    const stop = startFocusRefetch(5_000, 0)

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
    const stop = startFocusRefetch(0, 0)
    stop()

    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(cb).not.toHaveBeenCalled()

    off()
  })

  it('no refetchea si los datos están frescos (ventana de staleness)', () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const off = subscribeDataVersion(cb)
    markDataFresh(Date.now()) // alguien fetchió hace un instante
    const stop = startFocusRefetch(0, 60_000)

    window.dispatchEvent(new Event('focus'))
    expect(cb).not.toHaveBeenCalled()

    // Sigue fresco a los 59s → todavía no pide nada.
    vi.advanceTimersByTime(59_000)
    window.dispatchEvent(new Event('focus'))
    expect(cb).not.toHaveBeenCalled()

    // Pasó la ventana → refetch de la capa cuerpo.
    vi.advanceTimersByTime(2_000)
    window.dispatchEvent(new Event('focus'))
    expect(cb).toHaveBeenCalledTimes(1)
    expect(getDataFreshnessAge()).toBeGreaterThan(0)

    off()
    stop()
    markDataFresh(Date.now())
  })
})

describe('useFetchGate — refetch silencioso', () => {
  // El gate solo decide si hay que pintar spinner: misma key + re-ejecución por
  // bump = swap silencioso; key nueva (filtros/página) = spinner como siempre.
  function GatedProbe({ k, rev }: { k: string; rev: number }) {
    const { loading, begin, done } = useFetchGate(k)
    useEffect(() => {
      begin()
      const t = setTimeout(() => done(), 0)
      return () => clearTimeout(t)
    }, [k, rev, begin, done])
    return <span data-testid="gate">{loading ? 'loading' : 'idle'}</span>
  }

  it('spinner en la primera carga y al cambiar la key; silencioso con la misma key', async () => {
    const { rerender } = render(<GatedProbe k="a" rev={0} />)
    expect(screen.getByTestId('gate').textContent).toBe('loading')

    await waitFor(() => expect(screen.getByTestId('gate').textContent).toBe('idle'))

    // Misma key, re-ejecución por bump: conserva lo que tiene en pantalla.
    rerender(<GatedProbe k="a" rev={1} />)
    expect(screen.getByTestId('gate').textContent).toBe('idle')

    // Key nueva (filtro/página): spinner otra vez.
    rerender(<GatedProbe k="b" rev={1} />)
    expect(screen.getByTestId('gate').textContent).toBe('loading')
  })
})
