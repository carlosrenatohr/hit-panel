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
  const handlers = { onView: vi.fn(), onEdit: vi.fn(), onClose: vi.fn(), onVoid: vi.fn() }
  render(<InvoiceRowActions row={r} canWrite={canWrite} busy={busy} {...handlers} />)
  return handlers
}

describe('InvoiceRowActions', () => {
  it('open draft offers view, edit, close and void', () => {
    renderRow(row({ status: 'DRAFT', closedAt: null }))
    expect(screen.getByLabelText('Ver factura')).toBeTruthy()
    expect(screen.getByLabelText('Editar factura')).toBeTruthy()
    expect(screen.getByLabelText('Cerrar factura')).toBeTruthy()
    expect(screen.getByLabelText('Anular factura')).toBeTruthy()
  })

  it('issued invoice offers view and void, never edit/close', () => {
    renderRow(row({ status: 'ISSUED', closedAt: '2026-09-06' }))
    expect(screen.getByLabelText('Ver factura')).toBeTruthy()
    expect(screen.queryByLabelText('Editar factura')).toBeNull()
    expect(screen.queryByLabelText('Cerrar factura')).toBeNull()
    expect(screen.getByLabelText('Anular factura')).toBeTruthy()
  })

  it('paid invoice can be viewed and voided but never closed', () => {
    renderRow(row({ status: 'PAID', paidAt: '2026-09-07' }))
    expect(screen.queryByLabelText('Cerrar factura')).toBeNull()
    expect(screen.queryByLabelText('Editar factura')).toBeNull()
    expect(screen.getByLabelText('Anular factura')).toBeTruthy()
  })

  it('void invoice only offers view', () => {
    renderRow(row({ status: 'VOID' }))
    expect(screen.getByLabelText('Ver factura')).toBeTruthy()
    expect(screen.queryByLabelText('Editar factura')).toBeNull()
    expect(screen.queryByLabelText('Cerrar factura')).toBeNull()
    expect(screen.queryByLabelText('Anular factura')).toBeNull()
  })

  it('read-only users only get the view action', () => {
    renderRow(row({ status: 'DRAFT', closedAt: null }), false)
    expect(screen.getByLabelText('Ver factura')).toBeTruthy()
    expect(screen.queryByLabelText('Editar factura')).toBeNull()
    expect(screen.queryByLabelText('Cerrar factura')).toBeNull()
    expect(screen.queryByLabelText('Anular factura')).toBeNull()
  })

  it('fires its own handler and stops propagation of row clicks', () => {
    const handlers = renderRow(row({ status: 'ISSUED' }))
    fireEvent.click(screen.getByLabelText('Ver factura'))
    expect(handlers.onView).toHaveBeenCalledTimes(1)
  })
})