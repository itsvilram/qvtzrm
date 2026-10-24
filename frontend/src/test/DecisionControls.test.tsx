import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DecisionControls } from '../components/controls/DecisionControls.tsx'

function renderControls() {
  const onChange = vi.fn()
  render(
    <DecisionControls
      date="2026-01-15"
      cutoff="09:00"
      minDate="2026-01-01"
      maxDate="2026-01-31"
      onChange={onChange}
    />,
  )
  return onChange
}

describe('DecisionControls', () => {
  it('limits the decision date to January', () => {
    renderControls()

    const input = screen.getByLabelText('Decision date')
    expect(input).toHaveValue('2026-01-15')
    expect(input).toHaveAttribute('min', '2026-01-01')
    expect(input).toHaveAttribute('max', '2026-01-31')
  })

  it('reports a new date inside the range, and ignores one outside it', () => {
    const onChange = renderControls()
    const input = screen.getByLabelText('Decision date')

    fireEvent.change(input, { target: { value: '2026-01-27' } })
    fireEvent.change(input, { target: { value: '2026-02-15' } })

    expect(onChange.mock.calls).toEqual([[{ date: '2026-01-27' }]])
  })

  it('offers the auction-close cutoffs and reports a change', async () => {
    const onChange = renderControls()
    const select = screen.getByLabelText('Decision cutoff (UK time)')

    expect(screen.getByRole('option', { name: '09:50 · N2EX close' })).toBeInTheDocument()

    await userEvent.selectOptions(select, '09:50')

    expect(onChange).toHaveBeenCalledWith({ cutoff: '09:50' })
  })
})
