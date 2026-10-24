import { type KeyboardEvent, type ReactNode, useRef } from 'react'
import type { Tab } from '../../state/useUrlState.ts'
import styles from './Tabs.module.css'

const TABS: { id: Tab; label: string }[] = [
  { id: 'day-ahead', label: 'Day-ahead view' },
  { id: 'accuracy', label: 'Forecast accuracy' },
]

const tabId = (tab: Tab) => `tab-${tab}`
const panelId = (tab: Tab) => `panel-${tab}`

/** ARIA tabs: arrow keys, Home and End move between tabs and select them. */
export function Tabs({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = TABS.length - 1
    const target = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    onChange(TABS[target].id)
    buttons.current[target]?.focus()
  }

  return (
    <div role="tablist" aria-label="Views" className={styles.tablist}>
      {TABS.map((tab, index) => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={selected}
            aria-controls={selected ? panelId(tab.id) : undefined}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ tab, children }: { tab: Tab; children: ReactNode }) {
  return (
    <section role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
      {children}
    </section>
  )
}
