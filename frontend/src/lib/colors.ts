/**
 * Chart colours by role. The values are CSS variables defined once in styles/global.css, so
 * light and dark mode switch in one place; Recharts accepts `var(...)` for stroke and fill.
 *
 * Forecast vs actual are categorical slots 1–2 (blue, orange). Over- vs under-forecast is the
 * blue <-> red diverging pair. Both pairs pass the data-viz palette validator (colour-blind
 * separation, lightness band, >= 3:1 contrast) in light and dark mode.
 */
export const chartColors = {
  forecast: 'var(--series-forecast)',
  actual: 'var(--series-actual)',
  band: 'var(--band)',
  underForecast: 'var(--under-forecast)',
  overForecast: 'var(--over-forecast)',
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  label: 'var(--text-muted)',
} as const

export type ChartColor = keyof typeof chartColors
