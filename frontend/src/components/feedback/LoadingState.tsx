import styles from './feedback.module.css'

/** Grey blocks shaped like the summary cards and the chart, so the page doesn't jump when data arrives. */
export function LoadingState({ label = 'Loading wind data…' }: { label?: string }) {
  return (
    <div role="status" className={styles.loading}>
      <span className="visually-hidden">{label}</span>
      <div className="kpi-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${styles.block} ${styles.kpiBlock}`} />
        ))}
      </div>
      <div className={`${styles.block} ${styles.chartBlock}`} aria-hidden="true" />
    </div>
  )
}
