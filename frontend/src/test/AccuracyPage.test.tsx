import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccuracyPage } from '../pages/AccuracyPage.tsx'
import { ACCURACY } from './fixtures.ts'
import { json, mockApi, renderWithClient } from './render.tsx'

afterEach(() => vi.unstubAllGlobals())

function renderPage(onChange = vi.fn()) {
  renderWithClient(<AccuracyPage cutoff="09:00" onChange={onChange} />)
  return onChange
}

describe('AccuracyPage', () => {
  it('shows the period and the headline figures', async () => {
    const fetchMock = mockApi({ '/api/accuracy': () => json(200, ACCURACY) })

    renderPage()

    expect(await screen.findByText('2,039 MW')).toBeInTheDocument()
    expect(screen.getByText('2,505 MW')).toBeInTheDocument()
    expect(screen.getByText('+1,748 MW')).toBeInTheDocument()
    expect(screen.getByText('18.1%')).toBeInTheDocument()
    expect(screen.getByText('4,098 MW')).toBeInTheDocument()
    expect(screen.getByText(/· 100 hours/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/accuracy?cutoff=09%3A00')
  })

  it('turns the numbers into a recommendation', async () => {
    mockApi({ '/api/accuracy': () => json(200, ACCURACY) })

    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: 'Plan for about 4.1 GW less wind than the forecast',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'The forecast was too high in 85% of hours, by 1.7 GW on average, so without a margin you would usually buy too little power.',
      ),
    ).toBeInTheDocument()
  })

  it('explains each metric in an info tooltip', async () => {
    mockApi({ '/api/accuracy': () => json(200, ACCURACY) })
    renderPage()

    const info = await screen.findByRole('button', { name: 'About Bias' })

    expect(info).toHaveAccessibleDescription(/forecast expected more wind than turned up/)
  })

  it('opens a delivery day in the day-ahead view on its decision date', async () => {
    mockApi({ '/api/accuracy': () => json(200, ACCURACY) })
    const onChange = renderPage()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Open Wed 28 Jan in the day-ahead view' }),
    )

    expect(onChange).toHaveBeenCalledWith({ tab: 'day-ahead', date: '2026-01-27' })
  })

  it('changing the cutoff reports it', async () => {
    mockApi({ '/api/accuracy': () => json(200, ACCURACY) })
    const onChange = renderPage()

    await userEvent.selectOptions(
      await screen.findByLabelText('Decision cutoff (UK time)'),
      '09:50',
    )

    expect(onChange).toHaveBeenCalledWith({ cutoff: '09:50' })
  })

  it('shows the error state when the API fails', async () => {
    mockApi({ '/api/accuracy': () => json(503, { detail: 'Data source unavailable' }) })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Data source unavailable')
  })
})
