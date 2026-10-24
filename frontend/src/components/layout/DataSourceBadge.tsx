import type { Meta } from '../../api/types.ts'
import { formatUkDateTime } from '../../lib/format.ts'
import styles from './DataSourceBadge.module.css'

interface Props {
  source: Meta['data_source']
  fetchedAt: string
}

/** Shows whether the numbers are live from Elexon or from the saved snapshot, and how old they are. */
export function DataSourceBadge({ source, fetchedAt }: Props) {
  const live = source === 'live'
  return (
    <p className={styles.badge}>
      <span className={`${styles.pill} ${live ? styles.live : styles.snapshot}`}>
        <span className={styles.dot} aria-hidden="true" />
        {live ? 'Live data' : 'Saved snapshot'}
      </span>
      <span className={styles.detail}>Elexon · fetched {formatUkDateTime(fetchedAt)}</span>
    </p>
  )
}
