import type { Accuracy, DayAhead, DayAheadPoint, Meta } from '../api/types.ts'

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

const stats = { p10_mw: -549, p90_mw: 4098, n: 50 }

/** Real January headline figures at 09:00; 85 of 100 hours over-forecast. */
export const ACCURACY: Accuracy = {
  cutoff: '09:00',
  period: { delivery_from: '2026-01-02', delivery_to: '2026-02-01' },
  summary: {
    n_hours: 100,
    mae_mw: 2038.9,
    rmse_mw: 2504.8,
    bias_mw: 1747.9,
    nmae_pct: 18.1,
    p10_mw: -549.3,
    p50_mw: 1592,
    p90_mw: 4097.9,
    p90_abs_mw: 4097.9,
    max_over_mw: 6870,
    max_under_mw: -3550,
  },
  recommendation: { coverage: 0.9, buffer_mw: 4097.9 },
  by_hour: [
    { hour: 5, mae_mw: 2430, bias_mw: 2100, ...stats },
    { hour: 21, mae_mw: 1786, bias_mw: 1400, ...stats },
  ],
  by_horizon: [
    { bucket: '0-6h', bucket_start_h: 0, mae_mw: 1686, bias_mw: 1453, ...stats, n: 1446 },
    { bucket: '42-48h', bucket_start_h: 42, mae_mw: 2334, bias_mw: 1962, ...stats, n: 1457 },
    { bucket: '66-72h', bucket_start_h: 66, mae_mw: 2386, bias_mw: 762, ...stats, n: 31 },
  ],
  daily: [
    {
      delivery_date: '2026-01-19',
      mae_mw: 736,
      bias_mw: -730,
      ...stats,
      forecast_energy_mwh: 139_000,
      actual_energy_mwh: 157_000,
    },
    {
      delivery_date: '2026-01-28',
      mae_mw: 5375,
      bias_mw: 5375,
      ...stats,
      forecast_energy_mwh: 267_230,
      actual_energy_mwh: 138_235,
    },
  ],
  histogram: [
    { bin_start_mw: -1000, bin_end_mw: -500, count: 5 },
    { bin_start_mw: -500, bin_end_mw: 0, count: 10 },
    { bin_start_mw: 0, bin_end_mw: 500, count: 20 },
    { bin_start_mw: 500, bin_end_mw: 1000, count: 65 },
  ],
  missing_forecast_hours: 0,
}
