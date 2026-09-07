import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import type { InvoiceView, UnbilledPackage } from '../../lib/billing'
import InvoiceForm from './InvoiceForm'

const UNBILLED = vi.hoisted((): UnbilledPackage[] => [
  { packageId: 'p1', guia: 'SG-1', tracking: 'TRK1', status: 'entregado', serviceType: 'aereo', freightType: 'AIR', weightLb: 3, eligible: true, reason: null },
  { packageId: 'p2', guia: 'SG-2', tracking: null, status: 'entregado', serviceType: 'aereo', freightType: 'AIR', weightLb: null, eligible: false, reason: 'Sin peso' },
])

const createdView = vi.hoisted((): InvoiceView => ({
  id: 'inv1', invoiceNumber: 1, fiscalYear: 2026, clientId: 'c1', clientName: 'Ana',
  issueDate: '2026-09-05', paidAt: null, status: 'DRAFT', address: null, specialPrice: false,
  observations: null, trackingOrders: [], total: 21, profit: 6, margin: null, paidUsd: 0,
  outstanding: 21, closedAt: null, closedBy: null, lines: [], payments: [], packages: [],
}))

const createInvoice = vi.hoisted(() => vi.fn().mockResolvedValue(createdView))
const updateInvoice = vi.hoisted(() => vi.fn().mockResolvedValue(createdView))
const getInvoice = vi.hoisted(() => vi.fn().mockResolvedValue(createdView))
const unbilledPackages = vi.hoisted(() => vi.fn().mockResolvedValue({ clientId: 'c1', packages: UNBILLED }))

vi.mock('../../lib/billing', () => ({
  billingApi: {
    catalog: vi.fn().mockResolvedValue([]),
    unbilledPackages,
    createInvoice,
    updateInvoice,
    getInvoice,
  },
}))

vi.mock('../../lib/config', () => ({
  configApi: {
    listRates: vi.fn().mockResolvedValue({ tables: [] }),
    chargeConcepts: vi.fn().mockResolvedValue([]),
    info: vi.fn().mockResolvedValue({ slug: 'hit', name: 'HIT Cargo', ruc: null, address: null, phone: null, currency: 'USD', isScrapable: true }),
  },
}))

vi.mock('../ui/ClientSearch', () => ({
  default: ({ onSelect }: { onSelect: (c: { id: string; name: string }) => void }) => (
    <button type="button" onClick={() => onSelect({ id: 'c1', name: 'Ana' })}>select-client</button>
  ),
}))

function renderForm() {
  const onCreated = vi.fn()
  const onClose = vi.fn()
  render(<InvoiceForm onClose={onClose} onCreated={onCreated} />)
  return { onCreated, onClose }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('InvoiceForm guided flow', () => {
  it('blocks save before a client is selected', async () => {
    renderForm()
    fireEvent.click(screen.getByText('Crear factura'))
    await waitFor(() => expect(screen.getByText('El cliente es obligatorio.')).toBeTruthy())
    expect(createInvoice).not.toHaveBeenCalled()
  })

  it('loads the client unbilled packages and blocks save with no guide selected', async () => {
    renderForm()
    fireEvent.click(screen.getByText('select-client'))
    await waitFor(() => expect(unbilledPackages).toHaveBeenCalledWith('c1'))
    await waitFor(() => expect(screen.getByText('SG-1')).toBeTruthy())
    fireEvent.click(screen.getByText('Crear factura'))
    await waitFor(() => expect(screen.getByText('Selecciona al menos una guía del cliente.')).toBeTruthy())
    expect(createInvoice).not.toHaveBeenCalled()
  })

  it('shows ineligible packages disabled with their reason', async () => {
    renderForm()
    fireEvent.click(screen.getByText('select-client'))
    await waitFor(() => expect(screen.getByText('Sin peso')).toBeTruthy())
    expect(screen.getByText('Sin peso').closest('button')?.disabled).toBe(true)
  })

  it('selecting an eligible package adds one freight line and submits DRAFT with packageIds', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { onCreated } = renderForm()
    fireEvent.click(screen.getByText('select-client'))
    await waitFor(() => expect(screen.getByText('SG-1')).toBeTruthy())
    fireEvent.click(screen.getByText('SG-1'))
    await waitFor(() => expect(screen.getByText('SG-1')).toBeTruthy())
    fireEvent.click(screen.getByText('Crear factura'))
    await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(1))
    const payload = createInvoice.mock.calls[0][0]
    expect(payload.status).toBe('DRAFT')
    expect(payload.packageIds).toEqual(['p1'])
    expect(payload.lines[0]).toMatchObject({ packageId: 'p1', quantityLbs: 3, freightType: 'AIR' })
    expect(onCreated).toHaveBeenCalledWith(createdView)
  })
})