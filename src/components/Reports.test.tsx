import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import Reports from './Reports'
import type { SessionUser } from '../lib/types'

const exportPackages = vi.hoisted(() => vi.fn())
const getProviders = vi.hoisted(() => vi.fn())

vi.mock('../lib/config', () => ({
  configApi: { branding: vi.fn().mockResolvedValue({ agencies: [] }) },
}))
vi.mock('../lib/billing', () => ({
  billingApi: { linkedPackageIds: vi.fn().mockResolvedValue({ ids: [] }) },
}))
vi.mock('../lib/insforge', () => ({
  exportPackages,
  getProviders,
  listPackages: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
}))
vi.mock('./charts/ChartCanvas', () => ({ default: () => null }))
vi.mock('./MonthCalendar', () => ({ default: () => null }))

const pkg = (id: string, status: string, provider = 'everest', service = 'aereo') => ({
  id,
  almacen_id: `G-${id}`,
  tracking_number: null,
  effective_status: status,
  service_type: service,
  providers: { code: provider, name: provider },
  received_at: '2026-11-10T10:00:00Z',
  effective_weight_lb: 2,
})

const rows = [
  pkg('1', 'entregado'),
  pkg('2', 'entregado'),
  pkg('3', 'en_transito'),
  pkg('4', 'en_bodega_miami', 'everest', 'maritimo'),
  pkg('5', 'excepcion'),
]

const user = { id: 'u', email: 'a@b.c', role: 'admin' as const, name: 'Admin', agency: 'hit' as const } as SessionUser

describe('Reports — filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    exportPackages.mockResolvedValue(rows)
    getProviders.mockResolvedValue([
      { id: 'p1', code: 'everest', name: 'Everest' },
      { id: 'p2', code: 'gc', name: 'Global Connection' },
    ])
  })

  it('hides the provider filter when the agency works with a single provider', async () => {
    getProviders.mockResolvedValue([{ id: 'p1', code: 'everest', name: 'Everest' }])
    render(<Reports user={user} />)
    await waitFor(() => expect(exportPackages).toHaveBeenCalled())

    expect(screen.queryByText('Proveedores')).toBeNull()
    expect(screen.getByLabelText('Tipo de tarifa')).toBeInTheDocument()
  })

  it('shows the provider filter when there is more than one', async () => {
    render(<Reports user={user} />)
    await waitFor(() => expect(screen.getByText('Proveedores')).toBeInTheDocument())
  })

  it('counts each status in the chips and toggles several without refetching', async () => {
    render(<Reports user={user} />)
    const group = await screen.findByRole('group', { name: 'Filtrar reportes por estado' })
    await waitFor(() => expect(group).toHaveTextContent('Entregado2'))
    expect(group).toHaveTextContent('En tránsito1')

    const calls = exportPackages.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /En tránsito/ }))
    fireEvent.click(screen.getByRole('button', { name: /Entregado/ }))
    await waitFor(() => {
      const pressed = group.querySelectorAll('button[aria-pressed="true"]')
      expect(pressed).toHaveLength(2)
    })
    expect(exportPackages.mock.calls.length).toBe(calls)
    // Only the selected statuses feed the charts/KPIs.
    expect(screen.getByText('3 paquetes en el rango seleccionado.')).toBeInTheDocument()
  })

  it('sends the chosen tariff kind to the query', async () => {
    render(<Reports user={user} />)
    await waitFor(() => expect(exportPackages).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Tipo de tarifa'), { target: { value: 'fixed' } })
    await waitFor(() => expect(exportPackages.mock.calls.at(-1)![0]).toMatchObject({ pricingKind: 'fixed' }))
  })
})
