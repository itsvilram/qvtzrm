import type { Meta } from '../../api/types.ts'
import { DataSourceBadge } from './DataSourceBadge.tsx'
import styles from './Header.module.css'

export function Header({ meta }: { meta?: Meta }) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <div>
          <h1 className={styles.title}>
            <WindIcon />
            Wind Forecast Monitor
          </h1>
          <p className={styles.scope}>GB national wind · day-ahead decisions for January 2026</p>
        </div>
        {meta && <DataSourceBadge source={meta.data_source} fetchedAt={meta.fetched_at} />}
      </div>
    </header>
  )
}

function WindIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8h10a3 3 0 1 0-3-3" />
      <path d="M3 12h15a3 3 0 1 1-3 3" />
      <path d="M3 16h7" />
    </svg>
  )
}
