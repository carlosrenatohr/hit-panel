import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import type { InvoiceListRow } from '../../lib/billing'
import Facturacion from './Facturacion'

const listInvoices = vi.hoisted(() => vi.fn())
const archiveInvoice = vi.hoisted(() => vi.fn())

vi.mock('../../lib/billing', () => ({
  billingApi: {
    listInvoices,
    archiveInvoice,
    summary: vi.fn().mockResolvedValue(null),
    voidInvoice: vi.fn(),
    closeInvoice: vi.fn(),
    closeMonth: vi.fn(),
  },
}))

const ROW: InvoiceListRow = {
  id: 'i1', invoiceNumber: 7, fiscalYear: 2026, clientName: 'Ana', issueDate: '2026-09-05',
  paidAt: null, status: 'ISSUED', total: 6.5, profit: 2, paidUsd: 0, outstanding: 6.5,
  closedAt: '2026-09-06', closedBy: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// The list reloads twice before any action: on mount, then when the search
// debounce (350 ms) replaces the filters object. The post-archive reload is #3.
async function renderAndWait(role: 'admin' | 'billing' | 'viewer') {
  listInvoices.mockResolvedValue({ rows: [ROW], count: 1 })
  render(<Facturacion role={role} />)
  await screen.findByLabelText(role === 'viewer' ? 'Ver factura #7' : 'Archivar factura #7')
  if (role !== 'viewer') await waitFor(() => expect(listInvoices).toHaveBeenCalledTimes(2), { timeout: 2000 })
}

describe('Facturacion — archivar', () => {
  it('archives the invoice after confirmation and reloads the list', async () => {
    archiveInvoice.mockResolvedValue({ id: 'i1', archived: true })
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    await renderAndWait('admin')

    fireEvent.click(screen.getByLabelText('Archivar factura #7'))
    expect(confirm).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(archiveInvoice).toHaveBeenCalledWith('i1', 'Archivada desde la lista'))
    await waitFor(() => expect(listInvoices).toHaveBeenCalledTimes(3), { timeout: 2000 })
  })

  it('does not archive when the confirmation is declined', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    await renderAndWait('admin')

    fireEvent.click(screen.getByLabelText('Archivar factura #7'))
    expect(archiveInvoice).not.toHaveBeenCalled()
  })

  it('hides the archive action from viewers', async () => {
    await renderAndWait('viewer')
    expect(screen.queryByLabelText('Archivar factura #7')).toBeNull()
    expect(screen.queryByLabelText('Anular factura #7')).toBeNull()
  })
})
