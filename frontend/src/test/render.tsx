import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'

/** Render with a fresh query client (no retries, so failures show straight away). */
export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Handler = (url: URL) => Response

/** Fake the backend: each API path gets a handler; anything else is a 404. */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn((input: string) => {
    const url = new URL(input, 'http://localhost')
    const handler = routes[url.pathname]
    return Promise.resolve(handler ? handler(url) : json(404, { detail: 'Not Found' }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
