import type { ReactNode } from 'react'
import { AREA_OPACITY } from '../../lib/colors.ts'
import styles from './charts.module.css'

/** A short stroke in the series colour: legends and tooltips key lines with lines, not boxes. */
export function LineKey({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <svg className={styles.key} viewBox="0 0 16 8" aria-hidden="true">
      <line
        x1="1"
        y1="4"
        x2="15"
        y2="4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dashed ? '4 3' : undefined}
      />
    </svg>
  )
}

/** Swatch for an area or bar (legends mirror the mark). */
export function AreaKey({ color, opacity = AREA_OPACITY }: { color: string; opacity?: number }) {
  return (
    <svg className={styles.key} viewBox="0 0 16 8" aria-hidden="true">
      <rect x="1" y="0" width="14" height="8" rx="2" fill={color} fillOpacity={opacity} />
    </svg>
  )
}

export function ChartLegend({ children }: { children: ReactNode }) {
  return <ul className={styles.legend}>{children}</ul>
}

export function LegendItem({ marker, children }: { marker: ReactNode; children: ReactNode }) {
  return (
    <li className={styles.legendItem}>
      {marker}
      {children}
    </li>
  )
}

/** Tooltip card: a title, then rows where the value leads and the label follows. */
export function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipTitle}>{title}</p>
      <dl className={styles.tooltipRows}>{children}</dl>
    </div>
  )
}

export function TooltipRow({
  marker,
  value,
  label,
}: {
  marker?: ReactNode
  value: string
  label: string
}) {
  return (
    <div className={styles.tooltipRow}>
      <dt className={styles.tooltipLabel}>
        {marker}
        {label}
      </dt>
      <dd className={styles.tooltipValue}>{value}</dd>
    </div>
  )
}

/** The accessible twin of a chart: the same numbers as a table, one click away. */
export function TableView({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className={styles.tableView}>
      <summary>{summary}</summary>
      <div className={styles.tableScroll}>
        <table className={`${styles.table} tabular`}>{children}</table>
      </div>
    </details>
  )
}
