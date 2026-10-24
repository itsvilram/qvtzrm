import { EmptyState } from '../components/feedback/EmptyState.tsx'

// Placeholder: the day-ahead view is built in Task 5.
export function DayAheadPage({ date, cutoff }: { date: string; cutoff: string }) {
  return (
    <EmptyState
      title="Day-ahead view"
      message={`Decision date ${date}, cutoff ${cutoff}. The chart and summary arrive in the next task.`}
    />
  )
}
