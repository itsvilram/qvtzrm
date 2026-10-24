import styles from './feedback.module.css'

interface Props {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title = "Couldn't load wind data", message, onRetry }: Props) {
  return (
    <div role="alert" className={`card ${styles.message} ${styles.error}`}>
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
      <div className={styles.text}>
        <h2 className={styles.title}>{title}</h2>
        <p className="text-secondary">{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
