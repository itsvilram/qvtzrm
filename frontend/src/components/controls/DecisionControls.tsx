import type { ReactNode } from 'react'
import { CUTOFF_OPTIONS } from '../../lib/cutoffs.ts'
import type { UrlState } from '../../state/useUrlState.ts'
import styles from './controls.module.css'

interface Props {
  date: string
  cutoff: string
  minDate: string
  maxDate: string
  onChange: (change: Partial<UrlState>) => void
  /** Extra controls shown in the same row (e.g. the actuals toggle). */
  children?: ReactNode
}

/** The one filter row above the content: decision date and cutoff scope everything below. */
export function DecisionControls({ date, cutoff, minDate, maxDate, onChange, children }: Props) {
  return (
    <div className={styles.row}>
      <label className={styles.field}>
        <span className={styles.label}>Decision date</span>
        <input
          type="date"
          className={styles.input}
          value={date}
          min={minDate}
          max={maxDate}
          required
          onChange={(event) => {
            const value = event.target.value
            // Browsers let people type a date outside min/max, so check it here too.
            if (value >= minDate && value <= maxDate) onChange({ date: value })
          }}
        />
      </label>
      <CutoffSelect cutoff={cutoff} onChange={onChange} />
      {children}
    </div>
  )
}

export function CutoffSelect({
  cutoff,
  onChange,
}: {
  cutoff: string
  onChange: (change: Partial<UrlState>) => void
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>Decision cutoff (UK time)</span>
      <select
        className={styles.input}
        value={cutoff}
        onChange={(event) => onChange({ cutoff: event.target.value })}
      >
        {CUTOFF_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
