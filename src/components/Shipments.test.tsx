import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import Shipments from './Shipments';
import { listPackages, type ListFilters } from '../lib/insforge';

const mockPkgs = vi.hoisted(() => [
  {
    id: '1',
    almacen_id: '910500',
    tracking_number: '1Z999AA10123456784',
    status: 'en_almacen',
    manual_status: null,
    effective_status: 'en_almacen',
    raw_status: 'In Warehouse',
    service_type: 'aereo',
    service_type_override: null,
    effective_service_type: 'aereo',
    weight_lb: 5.2,
    volume_cf: null,
    pieces: 2,
    dimensions: null,
    origin_office: 'Miami',
    dest_office: 'Managua',
    description: 'Electronics',
    remitente: 'Amazon',
    referencia_name: 'John Doe',
    casillero: 'C-123',
    declared_value: 150,
    photo_ref: null,
    received_at: '2026-08-01T10:00:00Z',
    last_event_at: '2026-08-03T14:30:00Z',
    scraped_at: '2026-08-04T08:00:00Z',
    manual_status_by: null,
    manual_status_note: null,
    manual_status_at: null,
    client_id: null,
    billing_clients: null,
    provider_id: 'prov-1',
  },
  {
    id: '2',
    almacen_id: '910501',
    tracking_number: null,
    status: 'entregado',
    manual_status: null,
    effective_status: 'entregado',
    raw_status: 'Delivered',
    service_type: 'maritimo',
    service_type_override: null,
    effective_service_type: 'maritimo',
    weight_lb: 12.0,
    volume_cf: null,
    pieces: 1,
    dimensions: null,
    origin_office: 'Miami',
    dest_office: 'Managua',
    description: 'Clothing',
    remitente: 'Shein',
    referencia_name: 'Jane Smith',
    casillero: 'C-456',
    declared_value: 80,
    photo_ref: null,
    received_at: '2026-07-28T10:00:00Z',
    last_event_at: '2026-08-02T09:00:00Z',
    scraped_at: '2026-08-04T08:00:00Z',
    manual_status_by: null,
    manual_status_note: null,
    manual_status_at: null,
    client_id: null,
    billing_clients: null,
    provider_id: 'prov-2',
  },
]);

vi.mock('../lib/insforge', () => ({
  listPackages: vi.fn().mockImplementation((f: ListFilters) => {
    const st = f.statuses?.[0] ?? f.status;
    const count = st === 'entregado' ? 3 : st === 'excepcion' ? 1 : 2;
    return Promise.resolve({ rows: mockPkgs, count });
  }),
  getProviders: vi.fn().mockResolvedValue([]),
  exportPackages: vi.fn().mockResolvedValue(mockPkgs),
}));

const mockUser = { id: 'u-1', email: 'admin@hit-cargo.com', role: 'admin' as const, name: 'Admin', agency: 'hit' as const };

describe('Shipments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the shipments table with packages', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('910500').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('910501').length).toBeGreaterThan(0);
  });

  it('shows search input', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Buscar/)).toBeTruthy();
    });
  });

  it('displays result count', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText(/2 resultados/).length).toBeGreaterThan(0);
    });
  });

  it('refetches the list when refreshToken changes (e.g. after a soft delete)', async () => {
    const { rerender } = render(<Shipments user={mockUser} onOpen={() => {}} refreshToken={0} />);
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThanOrEqual(1));
    const before = vi.mocked(listPackages).mock.calls.length;

    rerender(<Shipments user={mockUser} onOpen={() => {}} refreshToken={1} />);

    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThan(before));
  });

  it('refetches the summary cards when refreshToken changes', async () => {
    const { rerender } = render(<Shipments user={mockUser} onOpen={() => {}} refreshToken={0} />);
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThanOrEqual(1));
    const before = vi.mocked(listPackages).mock.calls.length;

    rerender(<Shipments user={mockUser} onOpen={() => {}} refreshToken={1} />);

    // Summary fires N calls (one per status), list fires 1 call.
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThan(before + 1));
  });

  it('renders the lifecycle cards with their status counts', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    const entregado = await screen.findByRole('button', { name: /^Filtrar por Entregado$/ });
    expect(screen.getByRole('button', { name: /^Filtrar por En bodega Miami$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Filtrar por En tránsito$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Filtrar por En destino/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Filtrar por Parcial$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Filtrar por Excepción$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Filtrar por Desconocido$/ })).toBeTruthy();

    // Counters resolve to their per-status totals (entregado=3, excepción=1).
    await waitFor(() => expect(entregado.textContent).toContain('3'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Filtrar por Excepción$/ }).textContent).toContain('1'),
    );
  });

  it('filters the table when a lifecycle card is clicked', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /^Filtrar por Entregado$/ }));

    await waitFor(() => {
      const calls = vi.mocked(listPackages).mock.calls.map((c) => c[0]);
      expect(calls.some((f) => f.status === 'entregado')).toBe(true);
    });
  });

  it('filters by transport type when a tab is clicked', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /Aéreo/ }));

    await waitFor(() => {
      const calls = vi.mocked(listPackages).mock.calls.map((c) => c[0]);
      expect(calls.some((f) => f.service === 'aereo')).toBe(true);
    });
  });
});
