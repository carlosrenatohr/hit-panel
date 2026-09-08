import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import type { InvoiceView, UnbilledPackage } from '../../lib/billing'
import InvoiceForm from './InvoiceForm'

const UNBILLED = vi.hoisted((): UnbilledPackage[] => [
  { packageId: 'p1', guia: 'SG-1', tracking: 'TRK1', status: 'entregado', serviceType: 'aereo', freightType: 'AIR', weightLb: 3, eligible: true, reason: null },
  { packageId: 'p2', guia: 'SG-2', tracking: null, status: 'entregado', serviceType: 'aereo', freightType: 'AIR', weightLb: null, eligible: false, reason: 'Sin peso' },
  { packageId: 'p3', guia: 'SG-3', tracking: 'TRK3', status: 'entregado', serviceType: 'maritimo', freightType: 'MAR', weightLb: 2, eligible: true, reason: null },
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
    listRates: vi.fn().mockResolvedValue({ tables: [{ id: 't1', organizationId: 'hit', name: 'Estándar', freightType: 'AIR', createdAt: '', updatedAt: '', rows: [{ tier: 'REGULAR', price: 7, cost: 4.5, priceModel: 'weight' }] }] }),
    chargeConcepts: vi.fn().mockResolvedValue([]),
    info: vi.fn().mockResolvedValue({ slug: 'hit', name: 'HIT Cargo', ruc: null, address: null, phone: null, currency: 'USD', isScrapable: true }),
  },
}))

vi.mock('../ui/ClientSearch', () => ({
  default: ({ onSelect }: { onSelect: (c: { id: string; name: string; defaultRateId?: string | null }) => void }) => (
    <>
      <button type="button" onClick={() => onSelect({ id: 'c1', name: 'Ana' })}>select-client</button>
      <button type="button" onClick={() => onSelect({ id: 'c2', name: 'Luis', defaultRateId: 't1' })}>select-client-with-table</button>
    </>
  ),
}))

function renderForm() {
  const onCreated = vi.fn()
  const onClose = vi.fn()
  render(<InvoiceForm onClose={onClose} onCreated={onCreated} />)
  return { onCreated, onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
})

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

  it('preselects the client default rate table on guided freight lines', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderForm()
    fireEvent.click(screen.getByText('select-client-with-table'))
    await waitFor(() => expect(unbilledPackages).toHaveBeenCalled())
    fireEvent.click(screen.getByText('SG-1'))
    await waitFor(() => expect(screen.getByText('Estándar - Aéreo')).toBeTruthy())
    fireEvent.click(screen.getByText('Crear factura'))
    await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(1))
    const payload = createInvoice.mock.calls[0][0]
    expect(payload.lines[0]).toMatchObject({ packageId: 'p1', rateTableId: 't1' })
  })

  it('edit mode keeps linked guides selected and lets the user add more', async () => {
    const editView: InvoiceView = {
      ...createdView,
      id: 'inv1',
      clientId: 'c1',
      status: 'DRAFT',
      lines: [
        { lineNo: 1, description: null, freightType: 'AIR', lineType: 'freight', quantityLbs: 3, unitPrice: 7, total: 21, freightCost: 4.5, profit: 2, priceTier: 'REGULAR', priceOffCatalog: false, packageId: 'p1', packageGuia: 'SG-1', packageTracking: 'TRK1' },
      ],
      packages: [{ packageId: 'p1', source: 'manual', matchedOc: 'SG-1', guia: 'SG-1', tracking: 'TRK1' }],
    }
    getInvoice.mockResolvedValue(editView)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    const onCreated = vi.fn()
    render(<InvoiceForm invoiceId="inv1" onClose={() => {}} onCreated={onCreated} />)
    await waitFor(() => expect(screen.getByText('Editar factura')).toBeTruthy())
    await waitFor(() => expect(screen.getByText('SG-3')).toBeTruthy())
    const linked = screen.getByText('SG-1').closest('button')
    expect(linked?.disabled).toBe(false)
    fireEvent.click(screen.getByText('SG-3'))
    fireEvent.click(screen.getByText('Guardar cambios'))
    await waitFor(() => expect(updateInvoice).toHaveBeenCalledTimes(1))
    const body = updateInvoice.mock.calls[0][1] as { lines: Array<{ packageId: string | null }> }
    expect(body.lines.map((l) => l.packageId).filter(Boolean)).toEqual(['p1', 'p3'])
  })
})