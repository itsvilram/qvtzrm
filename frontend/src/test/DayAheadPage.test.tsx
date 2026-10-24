import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DayAheadPage } from '../pages/DayAheadPage.tsx'
import { DAY_AHEAD } from './fixtures.ts'
import { json, mockApi, renderWithClient } from './render.tsx'

function renderPage() {
  return renderWithClient(
    <DayAheadPage
      date="2026-01-27"
      cutoff="09:00"
      minDate="2026-01-01"
      maxDate="2026-01-31"
      onChange={() => {}}
    />,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('DayAheadPage', () => {
  it('shows which forecast was used and the summary cards', async () => {
    const fetchMock = mockApi({ '/api/day-ahead': () => json(200, DAY_AHEAD) })

    renderPage()

    expect(await screen.findByText('27 Jan 07:30')).toBeInTheDocument()
    expect(screen.getAllByText('Wed 28 Jan').length).toBeGreaterThan(0)
    expect(screen.getByText('267 GWh')).toBeInTheDocument()
    expect(screen.getByText('15.2 GW / 9.0 GW')).toBeInTheDocument()
    expect(screen.getByText('16.5–39.5 h ahead')).toBeInTheDocument()
    expect(screen.getByText('138 GWh')).toBeInTheDocument()
    expect(
      screen.getByText('Off by 5,375 MW on average · forecast 5,375 MW too high'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/day-ahead?decision_date=2026-01-27&cutoff=09%3A00')
  })

  it('hides the actuals when the toggle is off, to show what the trader saw', async () => {
    mockApi({ '/api/day-ahead': () => json(200, DAY_AHEAD) })
    renderPage()
    await screen.findByText('138 GWh')

    await userEvent.click(screen.getByLabelText('Show actuals (hindsight)'))

    expect(screen.queryByText('138 GWh')).not.toBeInTheDocument()
    expect(screen.queryByText('Actual (hindsight)')).not.toBeInTheDocument()
    expect(screen.getByText('267 GWh')).toBeInTheDocument()
  })

  it('notes hours without a forecast', async () => {
    mockApi({ '/api/day-ahead': () => json(200, { ...DAY_AHEAD, missing_forecast_hours: 2 }) })

    renderPage()

    expect(
      await screen.findByText(
        "2 hours without a forecast at this cutoff: the latest forecast didn't cover them yet.",
      ),
    ).toBeInTheDocument()
  })

  it('explains when no forecast existed yet', async () => {
    mockApi({ '/api/day-ahead': () => json(200, { ...DAY_AHEAD, points: [] }) })

    renderPage()

    expect(await screen.findByText('No forecast available at this cutoff')).toBeInTheDocument()
  })

  it('shows the error state when the API fails', async () => {
    mockApi({ '/api/day-ahead': () => json(503, { detail: 'Data source unavailable' }) })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Data source unavailable')
  })
})
