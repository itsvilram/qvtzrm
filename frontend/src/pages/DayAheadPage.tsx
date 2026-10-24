import { useState } from 'react'
import { useDayAhead } from '../api/hooks.ts'
import type { DayAhead } from '../api/types.ts'
import { KpiCard } from '../components/cards/KpiCard.tsx'
import { ForecastChart } from '../components/charts/ForecastChart.tsx'
import { ActualsToggle } from '../components/controls/ActualsToggle.tsx'
import { DecisionControls } from '../components/controls/DecisionControls.tsx'
import { EmptyState } from '../components/feedback/EmptyState.tsx'
import { ErrorState } from '../components/feedback/ErrorState.tsx'
import { LoadingState } from '../components/feedback/LoadingState.tsx'
import {
  formatEnergy,
  formatHoursRange,
  formatPower,
  formatUkDate,
  formatUkDateTime,
} from '../lib/format.ts'
import type { UrlState } from '../state/useUrlState.ts'
import styles from './pages.module.css'

interface Props {
  date: string
  cutoff: string
  minDate: string
  maxDate: string
  onChange: (change: Partial<UrlState>) => void
}

/** What the trader saw at the cutoff for tomorrow's delivery, and (optionally) what happened. */
export function DayAheadPage({ date, cutoff, minDate, maxDate, onChange }: Props) {
  const [showActuals, setShowActuals] = useState(true)
  const query = useDayAhead(date, cutoff)

  return (
    <div className="stack">
      <DecisionControls
        date={date}
        cutoff={cutoff}
        minDate={minDate}
        maxDate={maxDate}
        onChange={onChange}
      >
        <ActualsToggle checked={showActuals} onChange={setShowActuals} />
      </DecisionControls>

      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingState />
      ) : (
        // While a newly chosen day loads, the previous one stays on screen, faded.
        <div
          className={query.isPlaceholderData ? styles.stale : undefined}
          aria-busy={query.isPlaceholderData}
        >
          <DayAheadContent data={query.data} showActuals={showActuals} />
        </div>
      )}
    </div>
  )
}

function DayAheadContent({ data, showActuals }: { data: DayAhead; showActuals: boolean }) {
  const { summary, points } = data
  const deliveryDay = formatUkDate(data.delivery_date)

  if (points.length === 0) {
    return (
      <EmptyState
        title="No forecast available at this cutoff"
        message={`No wind forecast for ${deliveryDay} had been published by ${data.cutoff} on ${formatUkDate(data.decision_date)}. Choose a later cutoff.`}
      />
    )
  }

  const horizons = points.map((point) => point.horizon_h)
  const published = data.forecast_publish_times.map(formatUkDateTime).join(', ')

  return (
    <div className="stack">
      <p className={styles.context}>
        Using the forecast published <strong>{published}</strong> for delivery on{' '}
        <strong>{deliveryDay}</strong>
      </p>

      <MissingDataNotes data={data} showActuals={showActuals} />

      <div className="kpi-grid">
        <KpiCard
          label="Forecast energy"
          value={formatEnergy(summary.forecast_energy_mwh)}
          detail={`Total wind for ${deliveryDay}`}
        />
        <KpiCard
          label="Peak / lowest hour"
          value={`${formatPower(summary.peak_forecast_mw, 'GW')} / ${formatPower(summary.min_forecast_mw, 'GW')}`}
          detail="Forecast range across the day"
        />
        <KpiCard
          label="Forecast made"
          value={`${formatHoursRange(Math.min(...horizons), Math.max(...horizons))} ahead`}
          detail="From publication to each hour"
        />
        {showActuals && (
          <KpiCard
            label="Actual (hindsight)"
            value={formatEnergy(summary.actual_energy_mwh)}
            detail={hindsightText(summary.mae_mw, summary.bias_mw)}
          />
        )}
      </div>

      <section className="card stack" aria-labelledby="day-chart-title">
        <div>
          <h2 id="day-chart-title" className={styles.sectionTitle}>
            Wind generation on {deliveryDay}
          </h2>
          <p className={styles.sectionHint}>
            Hourly, UK time. The shaded range shows where the actual usually lands, based on
            January's forecast errors at each hour.
          </p>
        </div>
        <ForecastChart
          points={points}
          showActuals={showActuals}
          summary={chartSummary(data, showActuals)}
        />
      </section>
    </div>
  )
}

function MissingDataNotes({ data, showActuals }: { data: DayAhead; showActuals: boolean }) {
  const notes: string[] = []
  if (data.missing_forecast_hours > 0) {
    notes.push(
      `${hours(data.missing_forecast_hours)} without a forecast at this cutoff: the latest forecast didn't cover them yet.`,
    )
  }
  if (showActuals && data.missing_actual_hours > 0) {
    notes.push(`${hours(data.missing_actual_hours)} without actual generation data.`)
  }
  if (notes.length === 0) return null
  return (
    <ul className={styles.notes}>
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  )
}

function hindsightText(mae: number | null, bias: number | null): string {
  if (mae === null || bias === null) return 'No actual data yet'
  const direction =
    bias > 0
      ? `forecast ${formatPower(bias)} too high`
      : bias < 0
        ? `forecast ${formatPower(-bias)} too low`
        : 'no overall bias'
  return `Off by ${formatPower(mae)} on average · ${direction}`
}

function hours(count: number): string {
  return count === 1 ? '1 hour' : `${count} hours`
}

function chartSummary(data: DayAhead, showActuals: boolean): string {
  const { summary } = data
  const range = `forecast between ${formatPower(summary.min_forecast_mw, 'GW')} and ${formatPower(summary.peak_forecast_mw, 'GW')}`
  const hindsight =
    showActuals && summary.mae_mw !== null
      ? `; actual ${formatEnergy(summary.actual_energy_mwh)} versus ${formatEnergy(summary.forecast_energy_mwh)} forecast`
      : ''
  return `Hourly wind generation for ${formatUkDate(data.delivery_date)}: ${range}${hindsight}. Full values in the hourly table below.`
}
