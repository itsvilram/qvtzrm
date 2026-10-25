import { lazy, Suspense, useMemo } from 'react'
import { useMeta } from './api/hooks.ts'
import type { Meta } from './api/types.ts'
import styles from './App.module.css'
import { ErrorState } from './components/feedback/ErrorState.tsx'
import { LoadingState } from './components/feedback/LoadingState.tsx'
import { Footer } from './components/layout/Footer.tsx'
import { Header } from './components/layout/Header.tsx'
import { TabPanel, Tabs } from './components/layout/Tabs.tsx'
import { CUTOFF_VALUES } from './lib/cutoffs.ts'
import { type UrlLimits, useUrlState } from './state/useUrlState.ts'

// The pages (and the charting library they use) load separately, so the header shows sooner.
const DayAheadPage = lazy(() =>
  import('./pages/DayAheadPage.tsx').then((module) => ({ default: module.DayAheadPage })),
)
const AccuracyPage = lazy(() =>
  import('./pages/AccuracyPage.tsx').then((module) => ({ default: module.AccuracyPage })),
)

function App() {
  const meta = useMeta()

  return (
    <div className={styles.app}>
      <Header meta={meta.data} />
      {meta.isSuccess ? (
        <Dashboard meta={meta.data} />
      ) : (
        <main className="container">
          {/* After Retry the query is still in error while it refetches, so show loading then. */}
          {meta.isError && !meta.isFetching ? (
            <ErrorState message={meta.error.message} onRetry={() => void meta.refetch()} />
          ) : (
            <LoadingState />
          )}
        </main>
      )}
      <Footer />
    </div>
  )
}

/** Rendered once /api/meta has loaded, because the valid dates and cutoff come from it. */
function Dashboard({ meta }: { meta: Meta }) {
  const limits = useMemo<UrlLimits>(
    () => ({
      minDate: meta.decision_date_min,
      maxDate: meta.decision_date_max,
      defaultCutoff: meta.default_cutoff,
      cutoffs: CUTOFF_VALUES,
    }),
    [meta],
  )
  const [state, update] = useUrlState(limits)

  return (
    <main className="container stack">
      <Tabs active={state.tab} onChange={(tab) => update({ tab })} />
      <TabPanel tab={state.tab}>
        <Suspense fallback={<LoadingState />}>
          {state.tab === 'day-ahead' ? (
            <DayAheadPage
              date={state.date}
              cutoff={state.cutoff}
              minDate={limits.minDate}
              maxDate={limits.maxDate}
              onChange={update}
            />
          ) : (
            <AccuracyPage cutoff={state.cutoff} onChange={update} />
          )}
        </Suspense>
      </TabPanel>
    </main>
  )
}

export default App
