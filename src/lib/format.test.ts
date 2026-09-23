import { describe, expect, it, afterEach } from 'vitest'
import { fmtDate, toLocalDate } from './format'

const OLD_TZ = process.env.TZ

afterEach(() => {
  process.env.TZ = OLD_TZ
})

describe('fmtDate', () => {
  it('keeps the calendar day for date-only values in UTC− zones (no UTC-midnight shift)', () => {
    // Force a UTC− timezone so the date-only regression is deterministic in any CI.
    process.env.TZ = 'America/Managua'
    // Bare YYYY-MM-DD must render as the local calendar day, not UTC midnight (which
    // would fall one day behind in UTC− zones).
    const out = fmtDate('2026-09-23')
    const local = new Date('2026-09-23T00:00:00').toLocaleDateString('es-NI', { year: 'numeric', month: 'short', day: '2-digit' })
    expect(out).toBe(local)
    expect(out).toContain('23')
  })

  it('renders full ISO timestamps unchanged (timestamptz values)', () => {
    process.env.TZ = 'America/Managua'
    // A timestamptz at UTC 06:00 = local midnight in Managua → same calendar day.
    const out = fmtDate('2026-09-23T06:00:00.000Z')
    expect(out).toContain('23')
  })

  it('returns — for empty or invalid input', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
    expect(fmtDate('not-a-date')).toBe('—')
  })
})

describe('toLocalDate', () => {
  it('parses date-only values as local midnight', () => {
    process.env.TZ = 'America/Managua'
    const d = toLocalDate('2026-09-23')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8) // September
    expect(d.getDate()).toBe(23)
    expect(d.getHours()).toBe(0)
  })

  it('passes full ISO timestamps through untouched', () => {
    process.env.TZ = 'America/Managua'
    const iso = '2026-09-23T06:00:00.000Z'
    expect(toLocalDate(iso).toISOString()).toBe(iso)
  })
})