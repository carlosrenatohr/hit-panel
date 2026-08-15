import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import ShipmentDetail from './ShipmentDetail';

const mockDetail = vi.hoisted(() => ({
  pkg: {
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
    providers: { id: 'prov-1', code: 'everest', name: 'Everest' },
  },
  events: [
    {
      id: 'evt-1',
      occurred_at: '2026-08-03T14:30:00Z',
      office: 'Miami',
      description: 'Package received at warehouse',
      status: 'en_almacen',
      source: 'everest',
    },
  ],
  providerNotes: [],
  tags: [],
  notes: [],
}));

vi.mock('../lib/insforge', () => ({
  insforge: {},
  getPackageDetail: vi.fn().mockResolvedValue(mockDetail),
  setManualStatus: vi.fn().mockResolvedValue(undefined),
  addTag: vi.fn().mockResolvedValue(undefined),
  addNote: vi.fn().mockResolvedValue(undefined),
}));

const refreshPackage = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true, provider: 'everest' }));

vi.mock('../lib/refresh', () => ({
  refreshPackage,
  refreshCooldownUntil: vi.fn().mockReturnValue(0),
}));

const adminUser = { id: 'u-1', email: 'admin@hit-cargo.com', role: 'admin' as const, name: 'Admin', agency: 'hit' as const };

describe('ShipmentDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders package detail with guia', async () => {
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('910500').length).toBeGreaterThan(0);
    });
  });

  it('shows loading spinner initially', () => {
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} />);
    expect(screen.getByText(/Cargando/)).toBeTruthy();
  });

  it('displays provider name', async () => {
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('Everest').length).toBeGreaterThan(0);
    });
  });

  it('refreshes the package when admin clicks "Refrescar ahora"', async () => {
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByText('910500').length).toBeGreaterThan(0);
    });

    await fireEvent.click(screen.getByText('Refrescar ahora'));

    await waitFor(() => {
      expect(refreshPackage).toHaveBeenCalledWith('910500');
    });
  });

  it('hides the refresh button for non-admin roles', async () => {
    const staffUser = { ...adminUser, role: 'staff' as const };
    render(<ShipmentDetail guia="910500" user={staffUser} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByText('910500').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Refrescar ahora')).toBeNull();
  });
});
