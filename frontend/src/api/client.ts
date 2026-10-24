import type { Accuracy, DayAhead, Meta } from './types.ts'

// Empty by default: the API is on the same address (Vite proxy in development, Nginx or Vercel
// in production).
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** A failed API call. `status` is 0 when the server couldn't be reached at all. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams(params).toString()
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}${query ? `?${query}` : ''}`)
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.")
  }
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response))
  }
  return (await response.json()) as T
}

/** The backend sends `{ detail: string }`; FastAPI's own validation errors send a list of `{ msg }`. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const { detail } = (await response.json()) as { detail?: unknown }
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const messages = detail.map((item) => (item as { msg?: unknown }).msg)
      const text = messages.filter((msg) => typeof msg === 'string').join('; ')
      if (text) return text
    }
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return `Request failed (HTTP ${response.status})`
}

export function getMeta(): Promise<Meta> {
  return getJson<Meta>('/api/meta')
}

export function getDayAhead(decisionDate: string, cutoff: string): Promise<DayAhead> {
  return getJson<DayAhead>('/api/day-ahead', { decision_date: decisionDate, cutoff })
}

export function getAccuracy(cutoff: string): Promise<Accuracy> {
  return getJson<Accuracy>('/api/accuracy', { cutoff })
}
