import type { ReactNode } from 'react'
import styles from './KpiCard.module.css'

interface Props {
  label: string
  value: string
  /** Short supporting text under the value. */
  detail?: ReactNode
}

export function KpiCard({ label, value, detail }: Props) {
  return (
    <div className={`card ${styles.card}`}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  )
}
