import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import Shipments from './Shipments';

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
    provider_id: 'prov-2',
  },
]);

vi.mock('../lib/insforge', () => ({
  listPackages: vi.fn().mockResolvedValue({ rows: mockPkgs, count: 2 }),
  getProviders: vi.fn().mockResolvedValue([]),
  exportPackages: vi.fn().mockResolvedValue(mockPkgs),
}));

describe('Shipments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the shipments table with packages', async () => {
    render(<Shipments onOpen={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('910500').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('910501').length).toBeGreaterThan(0);
  });

  it('shows search input', async () => {
    render(<Shipments onOpen={() => {}} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Buscar/)).toBeTruthy();
    });
  });

  it('displays result count', async () => {
    render(<Shipments onOpen={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText(/2 resultados/).length).toBeGreaterThan(0);
    });
  });
});
