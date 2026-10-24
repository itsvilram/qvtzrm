import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'
import { META } from './fixtures.ts'
import { json, mockApi, renderWithClient } from './render.tsx'

beforeEach(() => window.history.replaceState(null, '', '/'))
afterEach(() => vi.unstubAllGlobals())

describe('App shell', () => {
  it('shows the header and where the data came from', async () => {
    mockApi({ '/api/meta': () => json(200, META) })

    renderWithClient(<App />)

    expect(await screen.findByText('Live data')).toBeInTheDocument()
    // 24 Oct is still British Summer Time: 14:05 UTC is 15:05 UK time.
    expect(screen.getByText('Elexon · fetched 24 Oct 15:05')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Wind Forecast Monitor' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Day-ahead view' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('labels snapshot data as such', async () => {
    mockApi({ '/api/meta': () => json(200, { ...META, data_source: 'snapshot' }) })

    renderWithClient(<App />)

    expect(await screen.findByText('Saved snapshot')).toBeInTheDocument()
  })

  it('switching tabs shows the other view and updates the URL', async () => {
    mockApi({ '/api/meta': () => json(200, META) })
    renderWithClient(<App />)

    await userEvent.click(await screen.findByRole('tab', { name: 'Forecast accuracy' }))

    expect(screen.getByRole('tab', { name: 'Forecast accuracy' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel', { name: 'Forecast accuracy' })).toBeInTheDocument()
    expect(window.location.search).toBe('?tab=accuracy&date=2026-01-31&cutoff=09%3A00')
  })

  it('arrow keys move between tabs', async () => {
    mockApi({ '/api/meta': () => json(200, META) })
    renderWithClient(<App />)
    const dayAhead = await screen.findByRole('tab', { name: 'Day-ahead view' })

    dayAhead.focus()
    await userEvent.keyboard('{ArrowRight}')

    const accuracy = screen.getByRole('tab', { name: 'Forecast accuracy' })
    expect(accuracy).toHaveAttribute('aria-selected', 'true')
    expect(accuracy).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(dayAhead).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the error with Retry when the API fails, and recovers', async () => {
    let calls = 0
    mockApi({
      '/api/meta': () =>
        ++calls === 1 ? json(503, { detail: 'Data source unavailable' }) : json(200, META),
    })
    renderWithClient(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Data source unavailable')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Live data')).toBeInTheDocument()
    expect(calls).toBe(2)
  })
})
