import { describe, expect, it } from 'vitest'
import { gigawattTick } from '../lib/chartStyle.ts'
import { addDays } from '../lib/dates.ts'
import { formatDayMonth } from '../lib/format.ts'

describe('addDays', () => {
  it('moves across month and year ends', () => {
    expect(addDays('2026-01-28', -1)).toBe('2026-01-27')
    expect(addDays('2026-02-01', -1)).toBe('2026-01-31')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30') // UK clocks change on 29 Mar
  })
})

describe('chart labels', () => {
  it('formats axis ticks in GW with a real minus sign', () => {
    expect(gigawattTick(4000)).toBe('4 GW')
    expect(gigawattTick(-2000)).toBe('−2 GW')
    expect(gigawattTick(0)).toBe('0 GW')
  })

  it('formats short dates', () => {
    expect(formatDayMonth('2026-01-28')).toBe('28 Jan')
  })
})
