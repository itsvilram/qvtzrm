import styles from './feedback.module.css'

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className={`card ${styles.message}`}>
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </svg>
      <div className={styles.text}>
        <h2 className={styles.title}>{title}</h2>
        <p className="text-secondary">{message}</p>
      </div>
    </div>
  )
}
