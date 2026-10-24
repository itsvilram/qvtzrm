import { useId } from 'react'
import styles from './InfoTip.module.css'

/** A small ⓘ that explains a metric in plain English, on hover and on keyboard focus. */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId()
  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        aria-label={`About ${label}`}
        aria-describedby={id}
      >
        i
      </button>
      <span role="tooltip" id={id} className={styles.tip}>
        {text}
      </span>
    </span>
  )
}
