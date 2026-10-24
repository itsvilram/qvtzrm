import { useAccuracy } from '../api/hooks.ts'
import type { Accuracy } from '../api/types.ts'
import { KpiCard } from '../components/cards/KpiCard.tsx'
import { RecommendationCard } from '../components/cards/RecommendationCard.tsx'
import { DailyErrorChart } from '../components/charts/DailyErrorChart.tsx'
import { ErrorByHourChart } from '../components/charts/ErrorByHourChart.tsx'
import { ErrorHistogram } from '../components/charts/ErrorHistogram.tsx'
import { HorizonChart } from '../components/charts/HorizonChart.tsx'
import { ControlsRow, CutoffSelect } from '../components/controls/DecisionControls.tsx'
import { ErrorState } from '../components/feedback/ErrorState.tsx'
import { LoadingState } from '../components/feedback/LoadingState.tsx'
import { addDays } from '../lib/dates.ts'
import { formatDayMonth, formatPercent, formatPower, formatSigned } from '../lib/format.ts'
import type { UrlState } from '../state/useUrlState.ts'
import styles from './pages.module.css'

interface Props {
  cutoff: string
  onChange: (change: Partial<UrlState>) => void
}

/** How accurate the forecasts available at the cutoff were, over all of January. */
export function AccuracyPage({ cutoff, onChange }: Props) {
  const query = useAccuracy(cutoff)

  // A delivery day was decided the day before, so open the day-ahead view on that decision date.
  const openDay = (deliveryDate: string) =>
    onChange({ tab: 'day-ahead', date: addDays(deliveryDate, -1) })

  return (
    <div className="stack">
      <ControlsRow>
        <CutoffSelect cutoff={cutoff} onChange={onChange} />
      </ControlsRow>

      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingState />
      ) : (
        <div
          className={query.isPlaceholderData ? styles.stale : undefined}
          aria-busy={query.isPlaceholderData}
        >
          <AccuracyContent data={query.data} onSelectDay={openDay} />
        </div>
      )}
    </div>
  )
}

function AccuracyContent({
  data,
  onSelectDay,
}: {
  data: Accuracy
  onSelectDay: (deliveryDate: string) => void
}) {
  const { summary, recommendation, period } = data
  const year = period.delivery_to.slice(0, 4)

  return (
    <div className="stack">
      <p className={styles.context}>
        Comparing the forecast available at <strong>{data.cutoff}</strong> with what actually
        happened, for delivery <strong>{formatDayMonth(period.delivery_from)}</strong> to{' '}
        <strong>
          {formatDayMonth(period.delivery_to)} {year}
        </strong>{' '}
        · {summary.n_hours.toLocaleString('en-GB')} hours
      </p>

      {data.missing_forecast_hours > 0 && (
        <ul className={styles.notes}>
          <li>
            {data.missing_forecast_hours} hours had no forecast yet at this cutoff and are left out.
          </li>
        </ul>
      )}

      {recommendation.buffer_mw !== null && summary.bias_mw !== null && (
        <RecommendationCard
          bufferMw={recommendation.buffer_mw}
          coverage={recommendation.coverage}
          biasMw={summary.bias_mw}
          overForecastShare={overForecastShare(data)}
          cutoff={data.cutoff}
        />
      )}

      <div className="kpi-grid">
        <KpiCard
          label="Average miss (MAE)"
          value={formatPower(summary.mae_mw)}
          detail="Typical gap, either direction"
          info="Mean absolute error: the average size of the gap between forecast and actual, whether the forecast was too high or too low."
        />
        <KpiCard
          label="RMSE"
          value={formatPower(summary.rmse_mw)}
          detail="Weighs big misses more"
          info="Root mean square error. Like MAE, but large misses count more. Much higher than MAE means occasional very large misses."
        />
        <KpiCard
          label="Bias"
          value={formatSigned(summary.bias_mw)}
          detail={biasDetail(summary.bias_mw)}
          info="The average of forecast − actual. Positive: the forecast expected more wind than turned up, so relying on it risks buying too little power."
        />
        <KpiCard
          label="Miss vs typical output"
          value={formatPercent(summary.nmae_pct)}
          detail="MAE ÷ average actual (nMAE)"
          info="Normalised MAE: the average miss as a share of average wind output, so it can be compared across periods with more or less wind."
        />
        <KpiCard
          label="90% of hours within"
          value={formatPower(summary.p90_abs_mw)}
          detail="P90 of the absolute miss"
          info="In 9 out of 10 hours the forecast missed by less than this, in either direction."
        />
      </div>

      <div className="chart-grid">
        <ErrorByHourChart byHour={data.by_hour} />
        <ErrorHistogram histogram={data.histogram} summary={summary} />
        <DailyErrorChart daily={data.daily} onSelectDay={onSelectDay} />
        <HorizonChart byHorizon={data.by_horizon} />
      </div>
    </div>
  )
}

/** Share of compared hours where the forecast was above the actual (bins start at 0 MW). */
function overForecastShare(data: Accuracy): number {
  const over = data.histogram
    .filter((bin) => bin.bin_start_mw >= 0)
    .reduce((total, bin) => total + bin.count, 0)
  return data.summary.n_hours > 0 ? over / data.summary.n_hours : 0
}

function biasDetail(bias: number | null): string {
  if (bias === null || bias === 0) return 'No overall lean'
  return bias > 0 ? 'Forecast too high on average' : 'Forecast too low on average'
}
