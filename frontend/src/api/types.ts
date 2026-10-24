/**
 * API response types. They mirror backend/app/schemas.py field for field.
 * Numbers arrive rounded to 1 decimal place; times are ISO-8601 UTC strings ("...Z");
 * dates are "YYYY-MM-DD".
 */

export interface Meta {
  decision_date_min: string
  decision_date_max: string
  default_cutoff: string
  timezone: string
  publish_times_utc: string[]
  data_source: 'live' | 'snapshot'
  /** When the data was fetched from Elexon (the snapshot date for snapshot data). */
  fetched_at: string
}

export interface DayAheadPoint {
  start_time: string
  publish_time: string
  horizon_h: number
  forecast_mw: number
  actual_mw: number | null
  error_mw: number | null
  band_low_mw: number | null
  band_high_mw: number | null
}

export interface DayAheadSummary {
  forecast_energy_mwh: number
  /** null unless every hour has an actual. */
  actual_energy_mwh: number | null
  peak_forecast_mw: number | null
  min_forecast_mw: number | null
  mae_mw: number | null
  bias_mw: number | null
}

export interface DayAhead {
  decision_date: string
  delivery_date: string
  cutoff: string
  forecast_publish_times: string[]
  summary: DayAheadSummary
  points: DayAheadPoint[]
  missing_forecast_hours: number
  missing_actual_hours: number
}

export interface Period {
  delivery_from: string
  delivery_to: string
}

export interface AccuracySummary {
  n_hours: number
  mae_mw: number | null
  rmse_mw: number | null
  bias_mw: number | null
  nmae_pct: number | null
  p10_mw: number | null
  p50_mw: number | null
  p90_mw: number | null
  p90_abs_mw: number | null
  max_over_mw: number | null
  max_under_mw: number | null
}

export interface Recommendation {
  coverage: number
  buffer_mw: number | null
}

export interface ErrorStats {
  mae_mw: number
  bias_mw: number
  p10_mw: number
  p90_mw: number
  n: number
}

export interface HourStats extends ErrorStats {
  hour: number
}

/** Uses every forecast, so it doesn't change with the cutoff. */
export interface HorizonStats extends ErrorStats {
  bucket: string
  bucket_start_h: number
}

export interface DailyStats extends ErrorStats {
  delivery_date: string
  forecast_energy_mwh: number
  actual_energy_mwh: number
}

export interface HistogramBin {
  bin_start_mw: number
  bin_end_mw: number
  count: number
}

export interface Accuracy {
  cutoff: string
  period: Period
  summary: AccuracySummary
  recommendation: Recommendation
  by_hour: HourStats[]
  by_horizon: HorizonStats[]
  daily: DailyStats[]
  histogram: HistogramBin[]
  missing_forecast_hours: number
}
