import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/preact'
import Customers from './Customers'
import { customerApi } from '../lib/customer'

const clients = vi.hoisted(() => [
  { id: 'c1', name: 'Ana', nameNormalized: 'ana', casillero: '5012', toReview: false, email: null, phone: null, address: null, companyName: null, taxId: null, active: true, defaultRateId: null, defaultRateCardId: null, packageCount: 3 },
  { id: 'c2', name: 'Luis', nameNormalized: 'luis', casillero: '5013', toReview: true, email: null, phone: null, address: null, companyName: 'Luis S.A.', taxId: 'J123', active: true, defaultRateId: null, defaultRateCardId: null, packageCount: 0 },
  { id: 'c3', name: 'Sara', nameNormalized: 'sara', casillero: null, toReview: false, email: null, phone: null, address: null, companyName: null, taxId: null, active: false, defaultRateId: null, defaultRateCardId: null, packageCount: 7 },
])

vi.mock('../lib/config', () => ({
  configApi: { listRateCards: vi.fn().mockResolvedValue({ organizationId: 'hit', cards: [] }) },
}))

vi.mock('../lib/customer', () => ({
  customerApi: {
    list: vi.fn().mockResolvedValue({ rows: clients, count: 3 }),
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
  },
}))

describe('Customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders clients with lifecycle statuses and package counts', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    expect(screen.getByText('Luis')).toBeInTheDocument()
    expect(screen.getByText('Sara')).toBeInTheDocument()
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0)
    expect(screen.getByTitle('Requiere revisión')).toBeInTheDocument()
    expect(screen.getByText('Desactivado')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('creates a client from the shared modal after confirming the dialog', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo cliente'))
    fireEvent.input(screen.getByLabelText('Nombre'), { target: { value: 'Beta' } })
    fireEvent.input(screen.getByLabelText('Cédula / RUC'), { target: { value: 'J999' } })
    fireEvent.click(screen.getByText('Guardar'))
    // ConfirmDialog confirm button (also labeled "Guardar") — the last one.
    fireEvent.click(screen.getAllByText('Guardar').at(-1)!)
    await waitFor(() => expect(customerApi.create).toHaveBeenCalled())
    expect(customerApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Beta', taxId: 'J999', companyName: null, defaultRateCardId: null }))
  })

  it('cancel closes the shared modal without calling the API', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo cliente'))
    fireEvent.click(screen.getByText('Cancelar'))
    expect(customerApi.create).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Cerrar')).not.toBeInTheDocument()
  })

  it('deactivates an active client after confirming the dialog', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /deshabilitar/i })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(customerApi.update).toHaveBeenCalled())
    expect(customerApi.update).toHaveBeenCalledWith('c1', { active: false })
  })

  it('reactivates an inactive client after confirming the dialog', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Sara')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /reactivar/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(customerApi.update).toHaveBeenCalled())
    expect(customerApi.update).toHaveBeenCalledWith('c3', { active: true })
  })

  it('editing a client preloads its fields', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Editar')[0])
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana')
    expect(screen.getByLabelText('Casillero')).toHaveValue('5012')
  })
})