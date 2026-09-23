import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { customerApi } from '../../lib/customer'
import ClientSearch from './ClientSearch'

vi.mock('../../lib/customer', () => ({
  customerApi: {
    list: vi.fn(),
  },
}))

const existing = {
  id: 'c1',
  name: 'Ana P',
  nameNormalized: 'ana p',
  casillero: null,
  toReview: false,
  email: null,
  phone: '50581234567',
  address: null,
  defaultRateId: null,
  defaultRateCardId: null,
}

describe('ClientSearch', () => {
  const onSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(customerApi.list).mockResolvedValue({ rows: [existing], count: 1 })
  })

  it('searches from the first character (tenant preference)', async () => {
    render(<ClientSearch value="" onSelect={onSelect} />)
    fireEvent.input(screen.getByPlaceholderText('Buscar cliente…'), { target: { value: 'A' } })
    await waitFor(() => expect(customerApi.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'A' })))
    expect(await screen.findByText('Ana P')).toBeTruthy()
  })

  it('does not search while the query is empty', async () => {
    render(<ClientSearch value="" onSelect={onSelect} />)
    fireEvent.input(screen.getByPlaceholderText('Buscar cliente…'), { target: { value: '  ' } })
    await new Promise((r) => setTimeout(r, 300))
    expect(customerApi.list).not.toHaveBeenCalled()
  })
})