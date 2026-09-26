import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/preact'
import type { InvoiceListRow } from '../../lib/billing'
import InvoiceRowActions from './InvoiceRowActions'

function row(over: Partial<InvoiceListRow>): InvoiceListRow {
  return {
    id: 'i1', invoiceNumber: 1, fiscalYear: 2026, clientName: 'Ana', issueDate: '2026-09-05',
    paidAt: null, status: 'DRAFT', total: 10, profit: 2, paidUsd: 0, outstanding: 10, closedAt: null, closedBy: null,
    ...over,
  }
}

function renderRow(r: InvoiceListRow, canWrite = true, busy = false) {
  const handlers = { onView: vi.fn(), onEdit: vi.fn(), onClose: vi.fn(), onVoid: vi.fn(), onArchive: vi.fn() }
  render(<InvoiceRowActions row={r} canWrite={canWrite} busy={busy} {...handlers} />)
  return handlers
}

describe('InvoiceRowActions', () => {
  it('open draft offers view, edit, close, void and archive', () => {
    renderRow(row({ status: 'DRAFT', closedAt: null }))
    expect(screen.getByLabelText('Ver factura #1')).toBeTruthy()
    expect(screen.getByLabelText('Editar factura #1')).toBeTruthy()
    expect(screen.getByLabelText('Cerrar factura #1')).toBeTruthy()
    expect(screen.getByLabelText('Anular factura #1')).toBeTruthy()
    expect(screen.getByLabelText('Archivar factura #1')).toBeTruthy()
    // Action icons carry the Customers module tooltip, not a bare title.
    expect(screen.getByRole('tooltip', { name: 'Ver factura #1' })).toBeTruthy()
    expect(screen.getByRole('tooltip', { name: 'Archivar factura #1 (la oculta de la lista y reportes)' })).toBeTruthy()
  })

  it('issued invoice offers view, void and archive, never edit/close', () => {
    renderRow(row({ status: 'ISSUED', closedAt: '2026-09-06' }))
    expect(screen.getByLabelText('Ver factura #1')).toBeTruthy()
    expect(screen.queryByLabelText('Editar factura #1')).toBeNull()
    expect(screen.queryByLabelText('Cerrar factura #1')).toBeNull()
    expect(screen.getByLabelText('Anular factura #1')).toBeTruthy()
    expect(screen.getByLabelText('Archivar factura #1')).toBeTruthy()
  })

  it('paid invoice can be viewed, voided and archived but never closed', () => {
    renderRow(row({ status: 'PAID', paidAt: '2026-09-07' }))
    expect(screen.queryByLabelText('Cerrar factura #1')).toBeNull()
    expect(screen.queryByLabelText('Editar factura #1')).toBeNull()
    expect(screen.getByLabelText('Anular factura #1')).toBeTruthy()
    expect(screen.getByLabelText('Archivar factura #1')).toBeTruthy()
  })

  it('void invoice only offers view and archive (clean-up)', () => {
    renderRow(row({ status: 'VOID' }))
    expect(screen.getByLabelText('Ver factura #1')).toBeTruthy()
    expect(screen.queryByLabelText('Editar factura #1')).toBeNull()
    expect(screen.queryByLabelText('Cerrar factura #1')).toBeNull()
    expect(screen.queryByLabelText('Anular factura #1')).toBeNull()
    expect(screen.getByLabelText('Archivar factura #1')).toBeTruthy()
  })

  it('read-only users only get the view action', () => {
    renderRow(row({ status: 'DRAFT', closedAt: null }), false)
    expect(screen.getByLabelText('Ver factura #1')).toBeTruthy()
    expect(screen.queryByLabelText('Editar factura #1')).toBeNull()
    expect(screen.queryByLabelText('Cerrar factura #1')).toBeNull()
    expect(screen.queryByLabelText('Anular factura #1')).toBeNull()
    expect(screen.queryByLabelText('Archivar factura #1')).toBeNull()
  })

  it('fires its own handler and stops propagation of row clicks', () => {
    const handlers = renderRow(row({ status: 'ISSUED' }))
    fireEvent.click(screen.getByLabelText('Ver factura #1'))
    expect(handlers.onView).toHaveBeenCalledTimes(1)
  })

  it('fires onArchive without bubbling to the row', () => {
    const handlers = renderRow(row({ status: 'VOID' }))
    fireEvent.click(screen.getByLabelText('Archivar factura #1'))
    expect(handlers.onArchive).toHaveBeenCalledTimes(1)
    expect(handlers.onView).not.toHaveBeenCalled()
  })
})