import { useCallback, useEffect, useState } from 'react'

/**
 * The tab, decision date and cutoff live in the URL (`?tab=day-ahead&date=2026-01-31&cutoff=09:00`),
 * so any view can be bookmarked or shared. Invalid values quietly fall back to the defaults.
 */

export type Tab = 'day-ahead' | 'accuracy'

export interface UrlState {
  tab: Tab
  date: string
  cutoff: string
}

/** What counts as valid; the dates and default cutoff come from /api/meta. */
export interface UrlLimits {
  minDate: string
  maxDate: string
  defaultCutoff: string
  cutoffs: readonly string[]
}

const TABS: readonly Tab[] = ['day-ahead', 'accuracy']

export function parseUrlState(search: string, limits: UrlLimits): UrlState {
  const params = new URLSearchParams(search)
  const tab = params.get('tab')
  const date = params.get('date')
  const cutoff = params.get('cutoff')
  return {
    tab: TABS.find((t) => t === tab) ?? 'day-ahead',
    // Latest decision date by default: "the latest forecast available when deciding".
    date: date && isDateWithin(date, limits.minDate, limits.maxDate) ? date : limits.maxDate,
    cutoff: cutoff && limits.cutoffs.includes(cutoff) ? cutoff : limits.defaultCutoff,
  }
}

export function toSearch(state: UrlState): string {
  return new URLSearchParams({ tab: state.tab, date: state.date, cutoff: state.cutoff }).toString()
}

export function useUrlState(limits: UrlLimits): [UrlState, (change: Partial<UrlState>) => void] {
  const [state, setState] = useState(() => parseUrlState(window.location.search, limits))

  // Mirror the state into the URL without adding browser-history entries.
  useEffect(() => {
    const search = `?${toSearch(state)}`
    if (window.location.search !== search) {
      window.history.replaceState(window.history.state, '', search)
    }
  }, [state])

  const update = useCallback((change: Partial<UrlState>) => {
    setState((current) => ({ ...current, ...change }))
  }, [])

  return [state, update]
}

function isDateWithin(value: string, min: string, max: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  // Reject impossible dates such as 2026-02-30 (they roll over to another day).
  const real = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(real.getTime()) || real.toISOString().slice(0, 10) !== value) return false
  return value >= min && value <= max
}
