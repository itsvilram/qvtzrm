import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip.tsx'
import styles from './KpiCard.module.css'

interface Props {
  label: string
  value: string
  /** Short supporting text under the value. */
  detail?: ReactNode
  /** Plain-English explanation shown in an ⓘ tooltip next to the label. */
  info?: string
}

export function KpiCard({ label, value, detail, info }: Props) {
  return (
    <div className={`card ${styles.card}`}>
      <p className={styles.label}>
        {label}
        {info && <InfoTip label={label} text={info} />}
      </p>
      <p className={styles.value}>{value}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  )
}
