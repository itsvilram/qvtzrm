import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { parseUrlState, type UrlLimits, useUrlState } from '../state/useUrlState.ts'

const LIMITS: UrlLimits = {
  minDate: '2026-01-01',
  maxDate: '2026-01-31',
  defaultCutoff: '09:00',
  cutoffs: ['07:00', '09:00', '09:50'],
}
const DEFAULTS = { tab: 'day-ahead', date: '2026-01-31', cutoff: '09:00' }

function setUrl(search: string) {
  window.history.replaceState(null, '', `/${search}`)
}

afterEach(() => setUrl(''))

describe('parseUrlState', () => {
  it('reads valid values', () => {
    expect(parseUrlState('?tab=accuracy&date=2026-01-15&cutoff=09:50', LIMITS)).toEqual({
      tab: 'accuracy',
      date: '2026-01-15',
      cutoff: '09:50',
    })
  })

  it('uses the defaults when nothing is set', () => {
    expect(parseUrlState('', LIMITS)).toEqual(DEFAULTS)
  })

  it.each([
    ['unknown tab', '?tab=settings'],
    ['date outside January', '?date=2026-02-15'],
    ['impossible date', '?date=2026-01-32'],
    ['badly formatted date', '?date=15-01-2026'],
    ['cutoff not offered in the UI', '?cutoff=10:15'],
    ['badly formatted cutoff', '?cutoff=9am'],
  ])('falls back to the default for an %s', (_, search) => {
    expect(parseUrlState(search, LIMITS)).toEqual(DEFAULTS)
  })
})

describe('useUrlState', () => {
  it('starts from the URL and writes changes back to it', () => {
    setUrl('?tab=accuracy&date=2026-01-15&cutoff=09:50')
    const { result } = renderHook(() => useUrlState(LIMITS))

    expect(result.current[0]).toEqual({ tab: 'accuracy', date: '2026-01-15', cutoff: '09:50' })

    act(() => result.current[1]({ tab: 'day-ahead', date: '2026-01-27' }))

    expect(result.current[0]).toEqual({ tab: 'day-ahead', date: '2026-01-27', cutoff: '09:50' })
    expect(window.location.search).toBe('?tab=day-ahead&date=2026-01-27&cutoff=09%3A50')
  })

  it('replaces invalid values in the URL with the defaults', () => {
    setUrl('?date=2026-02-15')
    renderHook(() => useUrlState(LIMITS))

    expect(window.location.search).toBe('?tab=day-ahead&date=2026-01-31&cutoff=09%3A00')
  })

  it('does not add browser-history entries', () => {
    const before = window.history.length
    const { result } = renderHook(() => useUrlState(LIMITS))

    act(() => result.current[1]({ cutoff: '07:00' }))

    expect(window.history.length).toBe(before)
  })
})
