import type { DayAhead, DayAheadPoint, Meta } from '../api/types.ts'

export const META: Meta = {
  decision_date_min: '2026-01-01',
  decision_date_max: '2026-01-31',
  default_cutoff: '09:00',
  timezone: 'Europe/London',
  publish_times_utc: [
    '02:30',
    '04:30',
    '07:30',
    '09:30',
    '11:30',
    '12:25',
    '15:30',
    '18:30',
    '22:30',
  ],
  data_source: 'live',
  fetched_at: '2026-10-24T14:05:56.140923Z',
}

function point(
  hour: string,
  forecast: number,
  actual: number | null,
  horizon: number,
): DayAheadPoint {
  return {
    start_time: `2026-01-28T${hour}:00Z`,
    publish_time: '2026-01-27T07:30:00Z',
    horizon_h: horizon,
    forecast_mw: forecast,
    actual_mw: actual,
    error_mw: actual === null ? null : forecast - actual,
    band_low_mw: forecast - 4000,
    band_high_mw: forecast + 600,
  }
}

/** Shaped like the real worst day: decision 27 Jan, forecast far above the actual. */
export const DAY_AHEAD: DayAhead = {
  decision_date: '2026-01-27',
  delivery_date: '2026-01-28',
  cutoff: '09:00',
  forecast_publish_times: ['2026-01-27T07:30:00Z'],
  summary: {
    forecast_energy_mwh: 267_230,
    actual_energy_mwh: 138_235,
    peak_forecast_mw: 15_200,
    min_forecast_mw: 9_000,
    mae_mw: 5_374.6,
    bias_mw: 5_374.6,
  },
  points: [point('00', 12_500, 7_190.5, 16.5), point('23', 15_200, 9_000, 39.5)],
  missing_forecast_hours: 0,
  missing_actual_hours: 0,
}
