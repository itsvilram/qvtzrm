import { chartColors } from './colors.ts'

/** Shared chart chrome: recessive hairline grid and muted axis text. */
export const axisTick = { fill: chartColors.label }
export const axisLine = { stroke: chartColors.axis }

/** Bars are at most 24 px wide; the rest of the slot stays empty. */
export const MAX_BAR_PX = 24

/** Hover highlight behind a bar (bars are their own hover target, so no crosshair). */
export const barCursor = { fill: 'var(--grid)', fillOpacity: 0.6 }

/** Bars with fewer hours than this are shown faded: too few to rely on. */
export const MIN_RELIABLE_HOURS = 100

/** MW → `4 GW`, with a real minus sign for negative ticks. */
export function gigawattTick(mw: number): string {
  const gw = mw / 1000
  return `${gw < 0 ? '−' : ''}${Math.abs(gw)} GW`
}
