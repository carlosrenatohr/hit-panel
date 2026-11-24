import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, act, within } from '@testing-library/preact'
import type { InvoiceListRow } from '../../lib/billing'
import Facturacion from './Facturacion'
import { bumpData } from '../../lib/dataVersion'

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
// debounce (350 ms) replaces the filters object. The post-archive reload is #3+
// (the bus bump and the local rev may batch into one or two more effect runs).
async function renderAndWait(role: 'admin' | 'billing' | 'viewer') {
  listInvoices.mockResolvedValue({ rows: [ROW], count: 1 })
  render(<Facturacion role={role} />)
  await screen.findByLabelText(role === 'viewer' ? 'Ver factura #7' : 'Archivar factura #7')
  if (role !== 'viewer') await waitFor(() => expect(listInvoices).toHaveBeenCalledTimes(2), { timeout: 2000 })
}

describe('Facturacion — listado', () => {
  it('asks for 20 rows by default and shows the range footer', async () => {
    await renderAndWait('admin')
    const last = listInvoices.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(last).toMatchObject({ page: 1, pageSize: 20 })
    // The default order is newest-first; the header must say so to screen readers.
    expect(screen.getByRole('columnheader', { name: /Factura/ })).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 1–1 de 1 factura')
  })

  it('sorts server-side from a header and flips the direction on the next click', async () => {
    await renderAndWait('admin')

    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Total' }))
    await waitFor(() => expect(listInvoices.mock.calls.at(-1)![0]).toMatchObject({ sort: 'total', ascending: true, page: 1 }))
    expect(screen.getByRole('columnheader', { name: /Total/ })).toHaveAttribute('aria-sort', 'ascending')

    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Total' }))
    await waitFor(() => expect(listInvoices.mock.calls.at(-1)![0]).toMatchObject({ sort: 'total', ascending: false }))
    expect(screen.getByRole('columnheader', { name: /Total/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('changes the page size from the footer and returns to page 1', async () => {
    await renderAndWait('admin')
    fireEvent.change(screen.getByLabelText('Filas por página'), { target: { value: '50' } })
    await waitFor(() => expect(listInvoices.mock.calls.at(-1)![0]).toMatchObject({ page: 1, pageSize: 50 }))
  })
})

describe('Facturacion — archivar', () => {
  it('archives the invoice after confirmation and reloads the list', async () => {
    archiveInvoice.mockResolvedValue({ id: 'i1', archived: true })
    await renderAndWait('admin')

    fireEvent.click(screen.getByLabelText('Archivar factura #7'))
    // The shared dialog replaces window.confirm.
    const dialog = await screen.findByRole('dialog', { name: 'Archivar factura' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archivar factura' }))
    await waitFor(() => expect(archiveInvoice).toHaveBeenCalledWith('i1', 'Archivada desde la lista'))
    await waitFor(() => expect(listInvoices.mock.calls.length).toBeGreaterThanOrEqual(3), { timeout: 2000 })
  })

  it('does not archive when the confirmation is declined', async () => {
    await renderAndWait('admin')

    fireEvent.click(screen.getByLabelText('Archivar factura #7'))
    const dialog = await screen.findByRole('dialog', { name: 'Archivar factura' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(archiveInvoice).not.toHaveBeenCalled()
  })

  it('hides the archive action from viewers', async () => {
    await renderAndWait('viewer')
    expect(screen.queryByLabelText('Archivar factura #7')).toBeNull()
    expect(screen.queryByLabelText('Anular factura #7')).toBeNull()
  })

  it('refetches the list when invoices/packages change from another view', async () => {
    await renderAndWait('admin')
    const before = listInvoices.mock.calls.length

    act(() => bumpData('invoices', 'packages'))

    await waitFor(() => expect(listInvoices.mock.calls.length).toBeGreaterThan(before), { timeout: 2000 })
  })
})
