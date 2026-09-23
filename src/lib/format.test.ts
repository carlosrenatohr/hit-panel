import { describe, expect, it } from 'vitest'
import { fmtDate, toLocalDate, altCurrencyTotal } from './format'

describe('fmtDate', () => {
  it('keeps the calendar day for date-only values', () => {
    // A bare YYYY-MM-DD must render as the LOCAL calendar day (local midnight),
    // not UTC midnight (which falls one day behind in UTC− zones).
    const out = fmtDate('2026-09-23')
    const local = new Date(2026, 8, 23).toLocaleDateString('es-NI', { year: 'numeric', month: 'short', day: '2-digit' })
    expect(out).toBe(local)
    expect(out).toContain('23')
  })

  it('renders full ISO timestamps as their own local date', () => {
    const iso = '2026-09-23T06:00:00.000Z'
    expect(fmtDate(iso)).toBe(new Date(iso).toLocaleDateString('es-NI', { year: 'numeric', month: 'short', day: '2-digit' }))
  })

  it('returns — for empty or invalid input', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
    expect(fmtDate('not-a-date')).toBe('—')
  })
})

describe('toLocalDate', () => {
  it('parses date-only values as local midnight', () => {
    const d = toLocalDate('2026-09-23')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8) // September
    expect(d.getDate()).toBe(23)
    expect(d.getHours()).toBe(0)
  })

  it('passes full ISO timestamps through untouched', () => {
    const iso = '2026-09-23T06:00:00.000Z'
    expect(toLocalDate(iso).toISOString()).toBe(iso)
  })
})

describe('altCurrencyTotal', () => {
  it('shows the córdoba equivalent when the working currency is USD', () => {
    const out = altCurrencyTotal(100, 'USD', 37)
    expect(out).toBe('≈ C$3,700.00 (tasa 37)')
  })

  it('shows the USD equivalent when the working currency is NIO', () => {
    const out = altCurrencyTotal(3700, 'NIO', 37)
    expect(out).toBe('≈ $100.00 (tasa 37)')
  })

  it('returns null without a rate (single-currency invoice)', () => {
    expect(altCurrencyTotal(100, 'USD', null)).toBeNull()
    expect(altCurrencyTotal(100, 'USD', undefined)).toBeNull()
    expect(altCurrencyTotal(100, 'USD', 0)).toBeNull()
  })
})