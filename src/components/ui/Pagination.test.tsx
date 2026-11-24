import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/preact'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('shows the visible range, the noun and the 10/20/50/100 options', () => {
    render(<Pagination page={2} count={138} pageSize={20} onPageChange={() => {}} onPageSizeChange={() => {}} noun="facturas" />)
    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 21–40 de 138 facturas')
    const options = [...(screen.getByLabelText('Filas por página') as HTMLSelectElement).options].map((o) => o.value)
    expect(options).toEqual(['10', '20', '50', '100'])
    expect((screen.getByLabelText('Filas por página') as HTMLSelectElement).value).toBe('20')
  })

  it('clamps the last page range to the total count', () => {
    render(<Pagination page={7} count={138} pageSize={20} onPageChange={() => {}} onPageSizeChange={() => {}} />)
    expect(screen.getByText('121–138')).toBeInTheDocument()
  })

  it('marks the current page, disables the edges and reports navigation', () => {
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()
    render(<Pagination page={1} count={100} pageSize={20} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />)

    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    fireEvent.change(screen.getByLabelText('Filas por página'), { target: { value: '50' } })
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })

  it('renders nothing when the result set is empty', () => {
    const { container } = render(<Pagination page={1} count={0} pageSize={20} onPageChange={() => {}} onPageSizeChange={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('keeps a single page usable so the page size can still be changed', () => {
    render(<Pagination page={1} count={5} pageSize={20} onPageChange={() => {}} onPageSizeChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled()
    expect(screen.getByLabelText('Filas por página')).toBeInTheDocument()
  })
})
