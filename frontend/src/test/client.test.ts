import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getAccuracy, getDayAhead, getMeta } from '../api/client.ts'
import { shouldRetry } from '../api/hooks.ts'

/** Each call gets a fresh Response, because a body can only be read once. */
function mockFetch(respond: () => Response | Error) {
  const fetchMock = vi.fn(() => {
    const response = respond()
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API client', () => {
  it('calls the right URL and returns the JSON body', async () => {
    const fetchMock = mockFetch(() => json(200, { delivery_date: '2026-01-16' }))

    const body = await getDayAhead('2026-01-15', '09:00')

    expect(fetchMock).toHaveBeenCalledWith('/api/day-ahead?decision_date=2026-01-15&cutoff=09%3A00')
    expect(body.delivery_date).toBe('2026-01-16')
  })

  it('builds URLs for meta and accuracy', async () => {
    const fetchMock = mockFetch(() => json(200, {}))

    await getMeta()
    await getAccuracy('09:50')

    expect(fetchMock.mock.calls).toEqual([['/api/meta'], ['/api/accuracy?cutoff=09%3A50']])
  })

  it('uses the backend message from a string detail', async () => {
    mockFetch(() =>
      json(422, { detail: 'decision_date must be between 2026-01-01 and 2026-01-31' }),
    )

    const error = await failure(getDayAhead('2026-02-15', '09:00'))

    expect(error.status).toBe(422)
    expect(error.message).toBe('decision_date must be between 2026-01-01 and 2026-01-31')
  })

  it("joins FastAPI's list-style validation messages", async () => {
    mockFetch(() =>
      json(422, {
        detail: [{ msg: 'Input should be a valid date' }, { msg: 'Field required' }],
      }),
    )

    const error = await failure(getDayAhead('tomorrow', '09:00'))

    expect(error.message).toBe('Input should be a valid date; Field required')
  })

  it('falls back to a generic message when the body is not JSON', async () => {
    mockFetch(() => new Response('Bad Gateway', { status: 502 }))

    const error = await failure(getMeta())

    expect(error.status).toBe(502)
    expect(error.message).toBe('Request failed (HTTP 502)')
  })

  it('reports a network failure with status 0', async () => {
    mockFetch(() => new TypeError('Failed to fetch'))

    const error = await failure(getMeta())

    expect(error.status).toBe(0)
    expect(error.message).toMatch("Couldn't reach the server")
  })
})

describe('retry policy', () => {
  it('retries server and network errors up to 2 times', () => {
    expect(shouldRetry(0, new ApiError(503, 'Data source unavailable'))).toBe(true)
    expect(shouldRetry(1, new ApiError(0, 'offline'))).toBe(true)
    expect(shouldRetry(2, new ApiError(503, 'Data source unavailable'))).toBe(false)
  })

  it('never retries 4xx errors', () => {
    expect(shouldRetry(0, new ApiError(422, 'bad cutoff'))).toBe(false)
  })
})
