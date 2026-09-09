import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact'
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
    deletePreview: vi.fn().mockResolvedValue({
      client: clients[0],
      packages: [{ guia: '926791', tracking: 'TRK1' }, { guia: '926845', tracking: null }],
      packageCount: 3,
      invoices: [{ fiscalYear: 2026, invoiceNumber: 104, status: 'PAID' }],
      invoiceCount: 2,
    }),
    delete: vi.fn(),
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

  it('deletes a client after showing the impact preview and confirming', async () => {
    render(<Customers role="admin" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0])

    await waitFor(() => expect(screen.getByText(/no tiene vuelta atrás/i)).toBeInTheDocument())
    expect(screen.getByText('3 paquetes relacionados:')).toBeInTheDocument()
    expect(screen.getByText('926791 · TRK1')).toBeInTheDocument()
    expect(screen.getByText('2 facturas relacionadas:')).toBeInTheDocument()
    expect(screen.getByText('2026-104 · Pagada')).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Eliminar cliente' })).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(customerApi.delete).toHaveBeenCalled())
    expect(customerApi.delete).toHaveBeenCalledWith('c1')
    // The list refetches after a soft delete (revision bump) — the row must leave the table.
    await waitFor(() => expect(vi.mocked(customerApi.list).mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('hides the delete action for staff', async () => {
    render(<Customers role="staff" />)
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
  })
})