import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/preact'
import Customers from './Customers'
import { customerApi } from '../lib/customer'

const clients = vi.hoisted(() => [
  { id: 'c1', name: 'Ana', nameNormalized: 'ana', casillero: '5012', toReview: false, email: null, phone: null, address: null, companyName: null, taxId: null, active: true, defaultRateId: null, packageCount: 3 },
  { id: 'c2', name: 'Luis', nameNormalized: 'luis', casillero: '5013', toReview: true, email: null, phone: null, address: null, companyName: 'Luis S.A.', taxId: 'J123', active: true, defaultRateId: null, packageCount: 0 },
  { id: 'c3', name: 'Sara', nameNormalized: 'sara', casillero: null, toReview: false, email: null, phone: null, address: null, companyName: null, taxId: null, active: false, defaultRateId: null, packageCount: 7 },
])

vi.mock('../lib/config', () => ({
  configApi: { listRates: vi.fn().mockResolvedValue({ organizationId: 'hit', tables: [] }) },
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
    window.confirm = vi.fn(() => true)
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

  it('creates a client from the modal after confirmation', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo cliente'))
    fireEvent.input(screen.getByLabelText('Nombre'), { target: { value: 'Beta' } })
    fireEvent.input(screen.getByLabelText('Cédula / RUC'), { target: { value: 'J999' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => expect(customerApi.create).toHaveBeenCalled())
    expect(customerApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Beta', taxId: 'J999', companyName: null }))
    expect(window.confirm).toHaveBeenCalled()
  })

  it('cancel closes the modal without calling the API', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Nuevo cliente'))
    fireEvent.click(screen.getByText('Cancelar'))
    expect(customerApi.create).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Cerrar formulario')).not.toBeInTheDocument()
  })

  it('deactivates an active client after confirmation', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getAllByRole('button', { name: /deshabilitar/i })[0])
    await waitFor(() => expect(customerApi.update).toHaveBeenCalled())
    expect(customerApi.update).toHaveBeenCalledWith('c1', { active: false })
    expect(window.confirm).toHaveBeenCalled()
  })

  it('reactivates an inactive client after confirmation', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Sara')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /reactivar/i }))
    await waitFor(() => expect(customerApi.update).toHaveBeenCalled())
    expect(customerApi.update).toHaveBeenCalledWith('c3', { active: true })
  })

  it('filters by status via MultiSelect', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Estado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Desactivado' }))
    await waitFor(() => expect(customerApi.list).toHaveBeenCalledWith(expect.objectContaining({ statuses: ['inactive'] })))
  })
})