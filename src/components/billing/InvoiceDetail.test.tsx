import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import InvoiceDetail from './InvoiceDetail'
import type { InvoiceView } from '../../lib/billing'

// Payment flow: the form prefills what is still owed (USD or NIO converted with
// the agency rate), refuses amounts above the balance, and asks for confirmation
// with the resulting balance before posting.

const invoice = (over: Partial<InvoiceView> = {}): InvoiceView => ({
  id: 'i1', invoiceNumber: 7, fiscalYear: 2026, clientId: 'c1', clientName: 'Ana',
  issueDate: '2026-11-01', paidAt: null, status: 'PARTIAL', address: null, specialPrice: false,
  observations: null, trackingOrders: [], total: 20, profit: 6, margin: null,
  paidUsd: 11, outstanding: 9, closedAt: '2026-11-02T10:00:00Z', closedBy: 'ana@hit.test',
  lines: [], payments: [], packages: [], integrityWarning: null,
  ...over,
})

const getInvoice = vi.hoisted(() => vi.fn())
const applyPayment = vi.hoisted(() => vi.fn())
const linkPackage = vi.hoisted(() => vi.fn())

vi.mock('../../lib/billing', () => ({
  billingApi: {
    getInvoice,
    invoiceEvents: vi.fn().mockResolvedValue({ events: [] }),
    applyPayment,
    linkPackage,
    shareInvoice: vi.fn(),
  },
}))

vi.mock('../../lib/customer', () => ({ customerApi: { get: vi.fn().mockResolvedValue({ phone: null }) } }))

vi.mock('../../lib/config', () => ({
  configApi: {
    branding: vi.fn().mockResolvedValue({ agencies: [] }),
    info: vi.fn().mockResolvedValue({
      slug: 'hit', name: 'HIT Cargo', ruc: null, address: null, phone: null, currency: 'USD',
      exchangeRateNioPerUsd: 36.5, isScrapable: false,
    }),
    paymentCatalogs: vi.fn().mockResolvedValue({ methods: [{ id: 'm1', name: 'Efectivo', active: true }], banks: [] }),
  },
}))

async function renderInvoice(view = invoice()) {
  getInvoice.mockResolvedValue(view)
  render(<InvoiceDetail id="i1" canWrite onClose={() => {}} />)
  await screen.findByText('Factura #7')
  // Wait for the agency profile (rate) to resolve.
  await waitFor(() => expect(screen.getByLabelText('Monto (USD)')).toBeTruthy())
}

describe('InvoiceDetail › pagos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyPayment.mockResolvedValue(invoice({ status: 'PAID', paidUsd: 20, outstanding: 0 }))
  })

  it('prefills the outstanding balance in USD', async () => {
    await renderInvoice()
    await waitFor(() => expect((screen.getByLabelText('Monto (USD)') as HTMLInputElement).value).toBe('9'))
  })

  it('converts the outstanding balance to NIO with the agency rate', async () => {
    await renderInvoice()
    await waitFor(() => expect((screen.getByLabelText('Monto (USD)') as HTMLInputElement).value).toBe('9'))

    fireEvent.change(screen.getByLabelText('Moneda'), { target: { value: 'NIO' } })
    await waitFor(() => expect((screen.getByLabelText('Monto (NIO)') as HTMLInputElement).value).toBe('328.5'))
    expect((screen.getByLabelText('Tasa (NIO por USD)') as HTMLInputElement).value).toBe('36.5')
  })

  it('blocks an amount above the balance with a red message', async () => {
    await renderInvoice()
    fireEvent.input(screen.getByLabelText('Monto (USD)'), { target: { value: '10' } })

    expect(await screen.findByText(/supera el saldo pendiente/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Revisar y registrar pago' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('asks for confirmation with the remaining balance and posts on confirm', async () => {
    await renderInvoice()
    fireEvent.input(screen.getByLabelText('Monto (USD)'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y registrar pago' }))

    const dialog = await screen.findByRole('dialog', { name: 'Confirmar registro de pago' })
    expect(within(dialog).getByText(/saldo de \$5\.00/)).toBeTruthy()
    expect(applyPayment).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() =>
      expect(applyPayment).toHaveBeenCalledWith('i1', expect.objectContaining({ amount: 4, currency: 'USD', fxRate: null })),
    )
  })

  it('sends the NIO amount with the resolved rate when the agency rate is used', async () => {
    await renderInvoice()
    fireEvent.change(screen.getByLabelText('Moneda'), { target: { value: 'NIO' } })
    await waitFor(() => expect((screen.getByLabelText('Monto (NIO)') as HTMLInputElement).value).toBe('328.5'))

    fireEvent.click(screen.getByRole('button', { name: 'Revisar y registrar pago' }))
    const dialog = await screen.findByRole('dialog', { name: 'Confirmar registro de pago' })
    expect(within(dialog).getByText(/factura queda pagada/i)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }))

    await waitFor(() =>
      expect(applyPayment).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({ amount: 328.5, currency: 'NIO', fxRate: 36.5 }),
      ),
    )
  })

  it('shows the outstanding balance in córdobas with the agency rate', async () => {
    await renderInvoice()
    expect(await screen.findByText(/C\$328\.50 a 36\.50 NIO\/USD/)).toBeTruthy()
  })

  it('keeps the córdoba deposit in the payment history next to its USD value', async () => {
    await renderInvoice(
      invoice({
        payments: [
          {
            method: 'Efectivo', bank: null, currency: 'NIO', amount: 328.5, amountUsd: 9,
            fxRate: 36.5, paidAt: '2026-11-20T10:00:00Z', raw: null, quarantined: false,
            reference: null, comments: null,
          },
        ],
      }),
    )
    expect(screen.getAllByText('$9.00').length).toBeGreaterThan(0)
    expect(screen.getByText('(C$328.50 en córdobas)')).toBeTruthy()
  })

  it('shows the total, paid and balance with their córdoba equivalents', async () => {
    await renderInvoice()
    // Total 20, paid 11 and balance 9 each carry their NIO line at 36.50.
    expect((await screen.findAllByText('C$730.00')).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText('C$401.50')).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText('C$328.50')).length).toBeGreaterThanOrEqual(1)
  })
})

describe('InvoiceDetail › enlazar guías', () => {
  const draft = () => invoice({ status: 'DRAFT', closedAt: null, closedBy: null, paidUsd: 0, outstanding: 20, packages: [] })

  async function openDraft() {
    render(<InvoiceDetail id="i1" canWrite onClose={() => {}} />)
    await screen.findByText('Factura #7')
    const input = screen.getByPlaceholderText('N.º de guía / almacén') as HTMLInputElement
    fireEvent.input(input, { target: { value: '214401' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enlazar' }))
  }
  beforeEach(() => {
    vi.clearAllMocks()
    getInvoice.mockResolvedValue(draft())
    linkPackage.mockResolvedValue(draft())
  })

  it('asks before linking and spells out the charge the guide will add', async () => {
    await openDraft()

    const dialog = await screen.findByRole('dialog', { name: '¿Enlazar esta guía?' })
    expect(within(dialog).getByText('214401')).toBeTruthy()
    expect(within(dialog).getByText('#7')).toBeTruthy()
    expect(within(dialog).getByText(/tarifa vigente del cliente/)).toBeTruthy()
    // Nothing is sent until the operator confirms.
    expect(linkPackage).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enlazar guía' }))
    await waitFor(() => expect(linkPackage).toHaveBeenCalledWith('i1', { guia: '214401' }))
  })

  it('explains a rejected link in a dialog and keeps the draft untouched', async () => {
    linkPackage.mockRejectedValue(new Error('El paquete 214401 ya está facturado (factura 6001).'))
    render(<InvoiceDetail id="i1" canWrite onClose={() => {}} />)
    await screen.findByText('Factura #7')
    fireEvent.input(screen.getByPlaceholderText('N.º de guía / almacén'), { target: { value: '214401' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enlazar' }))
    const confirm = await screen.findByRole('dialog', { name: '¿Enlazar esta guía?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Enlazar guía' }))

    const failure = await screen.findByRole('dialog', { name: 'No se pudo enlazar la guía' })
    expect(within(failure).getByText(/ya está facturado \(factura 6001\)/)).toBeTruthy()
    expect(within(failure).getByText(/No se guardó ningún cambio/)).toBeTruthy()
  })
})
