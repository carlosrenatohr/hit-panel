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
  integrityWarning: null,
}))

const createInvoice = vi.hoisted(() => vi.fn().mockResolvedValue(createdView))
const updateInvoice = vi.hoisted(() => vi.fn().mockResolvedValue(createdView))
const getInvoice = vi.hoisted(() => vi.fn().mockResolvedValue(createdView))
const unbilledPackages = vi.hoisted(() => vi.fn().mockResolvedValue({ clientId: 'c1', packages: UNBILLED }))
const getCustomer = vi.hoisted(() => vi.fn(async (id: string) => ({
  id,
  name: id === 'c-orig' ? 'Original Express' : 'Ana',
  nameNormalized: id === 'c-orig' ? 'original express' : 'ana',
  casillero: null, toReview: false, email: null, phone: null, address: null,
  defaultRateId: null,
  defaultRateCardId: id === 'c-orig' ? 't-orig' : null,
})))

vi.mock('../../lib/billing', () => ({
  billingApi: {
    catalog: vi.fn().mockResolvedValue([]),
    unbilledPackages,
    createInvoice,
    updateInvoice,
    getInvoice,
  },
}))

vi.mock('../../lib/customer', () => ({ customerApi: { get: getCustomer } }))

vi.mock('../../lib/config', () => ({
  configApi: {
    listRateCards: vi.fn().mockResolvedValue({
      organizationId: 'hit',
      cards: [
        {
          id: 't1',
          organizationId: 'hit',
          name: 'Estándar',
          structure: 'simple_pair',
          createdAt: '',
          updatedAt: '',
          currentVersion: {
            id: 'v1',
            version: 1,
            priceModel: 'weight',
            currency: 'USD',
            status: 'published',
            entries: [
              { id: 'e1', serviceType: 'AIR', name: 'Regular', unit: 'lb', price: 7, cost: 4.5 },
              { id: 'e2', serviceType: 'MAR', name: 'Regular', unit: 'lb', price: 2.8, cost: 1.25 },
            ],
          },
        },
        {
          id: 't-vip',
          organizationId: 'hit',
          name: 'Tarjeta VIP',
          structure: 'simple_pair',
          createdAt: '',
          updatedAt: '',
          currentVersion: {
            id: 'v-vip',
            version: 1,
            priceModel: 'weight',
            currency: 'USD',
            status: 'published',
            entries: [
              { id: 'ev1', serviceType: 'AIR', name: 'VIP', unit: 'lb', price: 5.5, cost: 4.5 },
            ],
          },
        },
        {
          id: 't-orig',
          organizationId: 'hit',
          name: 'Original Express',
          structure: 'simple_pair',
          createdAt: '',
          updatedAt: '',
          currentVersion: {
            id: 'v-orig',
            version: 1,
            priceModel: 'weight',
            currency: 'USD',
            status: 'published',
            entries: [
              { id: 'eo1', serviceType: 'AIR', name: 'Regular', unit: 'lb', price: 12, cost: 6 },
            ],
          },
        },
      ],
    }),
    chargeConcepts: vi.fn().mockResolvedValue([]),
    info: vi.fn().mockResolvedValue({ slug: 'hit', name: 'HIT Cargo', ruc: null, address: null, phone: null, currency: 'USD', isScrapable: true, exchangeRateNioPerUsd: null, exchangeRateSource: 'manual', exchangeRateUpdatedAt: null }),
  },
}))

vi.mock('../ui/ClientSearch', () => ({
  default: ({ onSelect }: { onSelect: (c: { id: string; name: string; defaultRateId?: string | null; defaultRateCardId?: string | null }) => void }) => (
    <>
      <button type="button" onClick={() => onSelect({ id: 'c1', name: 'Ana' })}>select-client</button>
      <button type="button" onClick={() => onSelect({ id: 'c2', name: 'Luis', defaultRateId: 't1' })}>select-client-with-table</button>
      <button type="button" onClick={() => onSelect({ id: 'c3', name: 'Carla', defaultRateCardId: 't1' })}>select-client-with-card</button>
      <button type="button" onClick={() => onSelect({ id: 'c-orig', name: 'Original Express', defaultRateCardId: 't-orig' })}>select-client-orig</button>
      <button type="button" onClick={() => onSelect({ id: 'c-vip', name: 'Vip Co', defaultRateCardId: 't-vip' })}>select-client-vip</button>
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
    await waitFor(() => expect(screen.getByText('Estándar')).toBeTruthy())
    fireEvent.click(screen.getByText('Crear factura'))
    await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(1))
    const payload = createInvoice.mock.calls[0][0]
    expect(payload.lines[0]).toMatchObject({ packageId: 'p1', rateTableId: 't1' })
  })

  it('shows the client special rate as the visible tariff (not just implied) and prices with it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderForm()
    fireEvent.click(screen.getByText('select-client-with-card'))
    await waitFor(() => expect(unbilledPackages).toHaveBeenCalledWith('c3'))
    fireEvent.click(await screen.findByText('SG-1'))
    // 3 lb × 7 (client card) — the select must name the card, not say "(tarifa del cliente)".
    const tariff = screen.getByLabelText(/Tarifa/) as HTMLSelectElement
    expect(tariff.value).toBe('t1')
    expect(tariff.selectedOptions[0]?.textContent).toBe('Estándar')
    expect(screen.getAllByText('$21.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$7.00/lb').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('Crear factura'))
    await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(1))
    const payload = createInvoice.mock.calls[0][0]
    expect(payload.lines[0]).toMatchObject({ packageId: 'p1', rateTableId: 't1' })
  })

  it('guided line starts on the card tier (no blank select) and submits it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderForm()
    fireEvent.click(screen.getByText('select-client-vip'))
    await waitFor(() => expect(unbilledPackages).toHaveBeenCalledWith('c-vip'))
    fireEvent.click(await screen.findByText('SG-1'))
    const tariff = screen.getByLabelText(/Tarifa/) as HTMLSelectElement
    expect(tariff.value).toBe('t-vip')
    const tier = screen.getByDisplayValue('VIP') as HTMLSelectElement
    expect(tier.value).toBe('VIP')
    expect(screen.getAllByText('$16.50').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('Crear factura'))
    await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(1))
    expect(createInvoice.mock.calls[0][0].lines[0]).toMatchObject({ packageId: 'p1', rateTableId: 't-vip', tier: 'VIP' })
  })

  it('edit mode keeps the line card that priced it and defaults the rest to the client card', async () => {
    const editView: InvoiceView = {
      ...createdView,
      id: 'inv2',
      clientId: 'c-orig',
      status: 'DRAFT',
      lines: [
        { lineNo: 1, description: null, freightType: 'AIR', lineType: 'freight', quantityLbs: 2, unitPrice: 7, total: 14, freightCost: 4.5, profit: 2, priceTier: 'REGULAR', priceOffCatalog: false, rateCardId: 't1', packageId: null, packageGuia: null, packageTracking: null },
        { lineNo: 2, description: null, freightType: 'AIR', lineType: 'freight', quantityLbs: 3, unitPrice: 5, total: 15, freightCost: 4.5, profit: 2, priceTier: 'REGULAR', priceOffCatalog: false, rateCardId: null, packageId: null, packageGuia: null, packageTracking: null },
      ],
      packages: [],
    }
    getInvoice.mockResolvedValue(editView)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<InvoiceForm invoiceId="inv2" onClose={() => {}} onCreated={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Editar factura')).toBeTruthy())
    await waitFor(() => expect(getCustomer).toHaveBeenCalledWith('c-orig'))
    const tariffs = (await screen.findAllByLabelText(/Tarifa/)) as HTMLSelectElement[]
    // Line 1 keeps its own card; line 2 inherits the client's assigned card.
    expect(tariffs[0].value).toBe('t1')
    expect(tariffs[1].value).toBe('t-orig')
    fireEvent.click(screen.getByText('Guardar cambios'))
    await waitFor(() => expect(updateInvoice).toHaveBeenCalledTimes(1))
    const body = updateInvoice.mock.calls[0][1] as { lines: Array<{ rateTableId: string | null }> }
    expect(body.lines.map((l) => l.rateTableId)).toEqual(['t1', 't-orig'])
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
      packages: [{ packageId: 'p1', source: 'manual', matchedOc: 'SG-1', guia: 'SG-1', tracking: 'TRK1', active: true }],
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
describe('InvoiceForm package-detail prefill (client rate)', () => {
  it('sends the assigned clientId and previews the client default card, not the catalog', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    const onCreated = vi.fn()
    render(
      <InvoiceForm
        prefill={{
          clientId: 'c-orig',
          clientName: 'ORIGINAL EXPRESS',
          packageIds: ['pkg-1'],
          lines: [{ freightType: 'AIR', tier: 'REGULAR', quantityLbs: 5, packageId: 'pkg-1', guia: 'G-1', tracking: null }],
        }}
        onClose={() => {}}
        onCreated={onCreated}
      />,
    )

    await waitFor(() => expect(getCustomer).toHaveBeenCalledWith('c-orig'))
    // 5 lb × 12 (client default card) — NOT × 7 (first org card/catalog).
    await waitFor(() => expect(screen.getAllByText('$60.00').length).toBeGreaterThan(0))
    expect(screen.getAllByText('$12.00/lb').length).toBeGreaterThan(0)
    // The client's card is the visible tariff, so the preview can't be mistaken
    // for the org default.
    expect((screen.getByLabelText(/Tarifa/) as HTMLSelectElement).value).toBe('t-orig')

    fireEvent.click(screen.getByText('Crear factura'))
    await waitFor(() => expect(createInvoice).toHaveBeenCalledTimes(1))
    const payload = createInvoice.mock.calls[0][0]
    expect(payload.clientId).toBe('c-orig')
    expect(payload.clientName).toBe('Original Express')
    expect(payload.lines[0]).toMatchObject({ packageId: 'pkg-1', quantityLbs: 5, freightType: 'AIR' })
    expect(onCreated).toHaveBeenCalledWith(createdView)
  })
})
