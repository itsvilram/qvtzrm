/**
 * Number and time formatting used everywhere in the UI, so units and styles stay consistent.
 * Negative numbers use a real minus sign (−), and times are always shown in UK time.
 */

const UK_TIMEZONE = 'Europe/London'
const MINUS = '−'
const EMPTY = '—'

/** Power values from this size up are shown in GW instead of MW. */
export const GW_THRESHOLD_MW = 10_000

function number(value: number, decimals: number): string {
  return Math.abs(value).toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function withSign(text: string, value: number, alwaysSign: boolean): string {
  if (value < 0) return MINUS + text
  if (alwaysSign && value > 0) return '+' + text
  return text
}

function power(mw: number, unit: 'auto' | 'MW' | 'GW'): string {
  const useGw = unit === 'GW' || (unit === 'auto' && Math.abs(mw) >= GW_THRESHOLD_MW)
  return useGw ? `${number(mw / 1000, 1)} GW` : `${number(mw, 0)} MW`
}

/** `9,350 MW` below 10,000 MW, otherwise `14.2 GW`. */
export function formatPower(mw: number | null, unit: 'auto' | 'MW' | 'GW' = 'auto'): string {
  if (mw === null) return EMPTY
  return withSign(power(mw, unit), mw, false)
}

/** A range in one unit for both ends: `5.9–10.4 GW`, not `5,867 MW – 10.4 GW`. */
export function formatPowerRange(lowMw: number, highMw: number): string {
  const useGw = Math.max(Math.abs(lowMw), Math.abs(highMw)) >= GW_THRESHOLD_MW
  const end = (mw: number) => withSign(useGw ? number(mw / 1000, 1) : number(mw, 0), mw, false)
  return `${end(lowMw)}–${end(highMw)} ${useGw ? 'GW' : 'MW'}`
}

/** Like formatPower, but always shows the sign: `+520 MW`, `−1.3 GW`, `0 MW`. */
export function formatSigned(mw: number | null, unit: 'auto' | 'MW' | 'GW' = 'auto'): string {
  if (mw === null) return EMPTY
  return withSign(power(mw, unit), mw, true)
}

/** MWh in, GWh out: `251 GWh` (1 decimal below 100 GWh, e.g. `19.4 GWh`). */
export function formatEnergy(mwh: number | null): string {
  if (mwh === null) return EMPTY
  const gwh = mwh / 1000
  return withSign(`${number(gwh, Math.abs(gwh) < 100 ? 1 : 0)} GWh`, gwh, false)
}

/** `18.1%` */
export function formatPercent(pct: number | null): string {
  if (pct === null) return EMPTY
  return withSign(`${number(pct, 1)}%`, pct, false)
}

/** `16.5 h` */
export function formatHoursAhead(hours: number): string {
  return `${number(hours, 1)} h`
}

/** `16.5–39.5 h` */
export function formatHoursRange(from: number, to: number): string {
  return `${number(from, 1)}–${number(to, 1)} h`
}

/** ISO time → `07:30` (UK time). */
export function formatUkTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** ISO time or `YYYY-MM-DD` → `Fri 16 Jan` (UK date). */
export function formatUkDate(isoOrDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(toDate(isoOrDate))
    .replace(',', '')
}

/** ISO time → `15 Jan 07:30` (UK time). */
export function formatUkDateTime(iso: string): string {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIMEZONE,
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso))
  return `${date} ${formatUkTime(iso)}`
}

function toDate(isoOrDate: string): Date {
  // A bare date means that calendar day; noon UTC keeps it on the same day in UK time all year.
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate) ? `${isoOrDate}T12:00:00Z` : isoOrDate)
}
