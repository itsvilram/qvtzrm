import { formatPower } from '../../lib/format.ts'
import styles from './RecommendationCard.module.css'

interface Props {
  bufferMw: number
  coverage: number
  biasMw: number
  /** Share of hours (0–1) where the forecast was higher than the actual. */
  overForecastShare: number
  cutoff: string
}

/** Turns the accuracy numbers into the one thing a trader can act on: how much margin to plan for. */
export function RecommendationCard({
  bufferMw,
  coverage,
  biasMw,
  overForecastShare,
  cutoff,
}: Props) {
  const coveragePct = Math.round(coverage * 100)
  const overPct = Math.round(overForecastShare * 100)
  const buffer = formatPower(Math.abs(bufferMw), 'GW')

  return (
    <section className={`card ${styles.card}`} aria-labelledby="recommendation-title">
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
      </svg>
      <div className={styles.body}>
        <p className={styles.kicker}>Recommendation</p>
        <h2 id="recommendation-title" className={styles.headline}>
          {bufferMw > 0
            ? `Plan for about ${buffer} less wind than the forecast`
            : 'No extra wind margin needed at this cutoff'}
        </h2>
        <p>
          {bufferMw > 0
            ? `In ${coveragePct}% of January's hours, the actual was at most ${buffer} below the forecast available at ${cutoff}. Planning with this margin would have covered you in 9 out of 10 hours.`
            : `In ${coveragePct}% of January's hours, the actual was at or above the forecast available at ${cutoff}.`}
        </p>
        <p>
          {biasMw > 0
            ? `The forecast was too high in ${overPct}% of hours, by ${formatPower(biasMw, 'GW')} on average, so without a margin you would usually buy too little power.`
            : `The forecast was too low in ${100 - overPct}% of hours, by ${formatPower(-biasMw, 'GW')} on average, so without adjusting you would usually buy too much power.`}
        </p>
        <p className={styles.note}>
          Based on January 2026. Past errors are a guide, not a guarantee.
        </p>
      </div>
    </section>
  )
}
