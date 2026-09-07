import { act, renderHook } from '@testing-library/preact'
import { afterEach, describe, expect, it } from 'vitest'
import { BILLING_SECTION_DEFS, BILLING_SECTIONS_KEY, useReportSections } from './ReportSections'

afterEach(() => localStorage.clear())

describe('useReportSections (billing)', () => {
  it('persists billing section visibility to its own storage key', () => {
    const { result } = renderHook(() => useReportSections(BILLING_SECTION_DEFS, BILLING_SECTIONS_KEY))
    expect(result.current.visible('mes')).toBe(true)
    act(() => result.current.toggle('mes'))
    expect(result.current.visible('mes')).toBe(false)
    const saved = JSON.parse(localStorage.getItem(BILLING_SECTIONS_KEY) ?? '[]') as Array<{ key: string; visible: boolean }>
    expect(saved).toEqual(expect.arrayContaining([{ key: 'mes', visible: false }]))
  })

  it('reset restores every billing section to visible', () => {
    const { result } = renderHook(() => useReportSections(BILLING_SECTION_DEFS, BILLING_SECTIONS_KEY))
    act(() => result.current.toggle('kpis'))
    act(() => result.current.toggle('calendario'))
    act(() => result.current.reset())
    expect(result.current.visible('kpis')).toBe(true)
    expect(result.current.visible('calendario')).toBe(true)
    expect(result.current.visible('flete-ingresos')).toBe(true)
  })
})