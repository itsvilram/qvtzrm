import { describe, expect, it } from 'vitest'
import {
  formatEnergy,
  formatHoursAhead,
  formatHoursRange,
  formatPercent,
  formatPower,
  formatPowerRange,
  formatSigned,
  formatUkDate,
  formatUkDateTime,
  formatUkTime,
} from '../lib/format.ts'

describe('formatPower', () => {
  it('uses MW below 10,000 MW and GW from 10,000 MW', () => {
    expect(formatPower(9350)).toBe('9,350 MW')
    expect(formatPower(9999.4)).toBe('9,999 MW')
    expect(formatPower(10_000)).toBe('10.0 GW')
    expect(formatPower(14_200)).toBe('14.2 GW')
  })

  it('can force a unit', () => {
    expect(formatPower(4097.9, 'GW')).toBe('4.1 GW')
    expect(formatPower(14_200, 'MW')).toBe('14,200 MW')
  })

  it('uses a real minus sign and a dash for missing values', () => {
    expect(formatPower(-3550)).toBe('−3,550 MW')
    expect(formatPower(null)).toBe('—')
  })
})

describe('formatPowerRange', () => {
  it('uses one unit for both ends', () => {
    expect(formatPowerRange(5867, 10_400)).toBe('5.9–10.4 GW')
    expect(formatPowerRange(3200, 8100)).toBe('3,200–8,100 MW')
    expect(formatPowerRange(-549, 4098)).toBe('−549–4,098 MW')
  })
})

describe('formatSigned', () => {
  it('always shows the sign, except for zero', () => {
    expect(formatSigned(520)).toBe('+520 MW')
    expect(formatSigned(-1300, 'GW')).toBe('−1.3 GW')
    expect(formatSigned(1747.9)).toBe('+1,748 MW')
    expect(formatSigned(0)).toBe('0 MW')
    expect(formatSigned(null)).toBe('—')
  })
})

describe('formatEnergy', () => {
  it('converts MWh to GWh', () => {
    expect(formatEnergy(251_000)).toBe('251 GWh')
    expect(formatEnergy(190_330)).toBe('190 GWh')
    expect(formatEnergy(19_400)).toBe('19.4 GWh')
    expect(formatEnergy(null)).toBe('—')
  })
})

describe('other numbers', () => {
  it('formats percentages and hours ahead', () => {
    expect(formatPercent(18.14)).toBe('18.1%')
    expect(formatHoursAhead(16.5)).toBe('16.5 h')
    expect(formatHoursRange(16.5, 39.5)).toBe('16.5–39.5 h')
  })
})

describe('UK time', () => {
  it('shows winter times as GMT', () => {
    expect(formatUkTime('2026-01-15T07:30:00Z')).toBe('07:30')
    expect(formatUkDateTime('2026-01-15T07:30:00Z')).toBe('15 Jan 07:30')
  })

  it('shows summer times as BST (UTC+1)', () => {
    expect(formatUkTime('2026-07-01T08:00:00Z')).toBe('09:00')
    expect(formatUkDate('2026-06-30T23:30:00Z')).toBe('Wed 1 Jul')
  })

  it('formats a bare date as that calendar day', () => {
    expect(formatUkDate('2026-01-16')).toBe('Fri 16 Jan')
    expect(formatUkDate('2026-07-01')).toBe('Wed 1 Jul')
  })
})
