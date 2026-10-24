import { keepPreviousData, QueryClient, useQuery } from '@tanstack/react-query'
import { ApiError, getAccuracy, getDayAhead, getMeta } from './client.ts'

// January's data never changes, so results never go stale; unused results are dropped after 10 min.
const TEN_MINUTES = 10 * 60 * 1000
const MAX_RETRIES = 2

/** Retry network and server errors (up to 2 times), but not 4xx: the request itself is wrong. */
export function shouldRetry(failureCount: number, error: Error): boolean {
  const clientError = error instanceof ApiError && error.status >= 400 && error.status < 500
  return !clientError && failureCount < MAX_RETRIES
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: TEN_MINUTES,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
    },
  })
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: getMeta })
}

/** Keeps showing the previous day while a newly chosen day loads, so the page doesn't jump. */
export function useDayAhead(decisionDate: string, cutoff: string) {
  return useQuery({
    queryKey: ['day-ahead', decisionDate, cutoff],
    queryFn: () => getDayAhead(decisionDate, cutoff),
    placeholderData: keepPreviousData,
  })
}

export function useAccuracy(cutoff: string) {
  return useQuery({
    queryKey: ['accuracy', cutoff],
    queryFn: () => getAccuracy(cutoff),
    placeholderData: keepPreviousData,
  })
}
