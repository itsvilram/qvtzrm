import styles from './controls.module.css'

/** Turning actuals off shows exactly what the trader could see when deciding. */
export function ActualsToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Show actuals (hindsight)
    </label>
  )
}
