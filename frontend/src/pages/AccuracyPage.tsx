import { EmptyState } from '../components/feedback/EmptyState.tsx'

// Placeholder: the forecast accuracy view is built in Task 6.
export function AccuracyPage({ cutoff }: { cutoff: string }) {
  return (
    <EmptyState
      title="Forecast accuracy"
      message={`Cutoff ${cutoff}. The accuracy figures and charts arrive in a later task.`}
    />
  )
}
