import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import ShipmentDetail from './ShipmentDetail';
import { deletePackage, getPackageDetail, setPackageClient } from '../lib/insforge';
import type { PackageDetail } from '../lib/types';

// The untyped mockDetail fixture misses a few Pkg fields; build overrides from it
// with a typed cast so vi.mocked() strict typing stays happy in these tests.
function detailWith(patch: Record<string, unknown>): PackageDetail {
  return { ...mockDetail, pkg: { ...mockDetail.pkg, ...patch } } as unknown as PackageDetail;
}

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
  deletePackage: vi.fn().mockResolvedValue(undefined),
  setPackageClient: vi.fn().mockResolvedValue(undefined),
  setPackageService: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/config', () => ({
  configApi: {
    info: vi.fn().mockResolvedValue({ slug: 'hit', name: 'HIT Cargo', ruc: null, address: null, phone: null, currency: 'USD', isScrapable: true }),
    branding: vi.fn().mockResolvedValue({ agencies: [] }),
    paymentCatalogs: vi.fn().mockResolvedValue({ methods: [], banks: [] }),
    proxyPhotoUrl: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('./ui/ClientSearch', () => ({
  default: ({ value, onSelect }: { value?: string; onSelect: (c: { id: string; name: string }) => void }) => (
    <button type="button" onClick={() => onSelect({ id: 'client-1', name: 'Test Client' })}>
      Mock ClientSearch: {value || '(vacío)'}
    </button>
  ),
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
    const onChanged = vi.fn();
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} onChanged={onChanged} />);
    await waitFor(() => {
      expect(screen.getAllByText('910500').length).toBeGreaterThan(0);
    });

    await fireEvent.click(screen.getByText('Refrescar ahora'));

    await waitFor(() => {
      expect(refreshPackage).toHaveBeenCalledWith('910500');
      expect(onChanged).toHaveBeenCalled();
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

  it('soft-deletes the package after showing the hard confirmation and closes the detail', async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={onClose} onDeleted={onDeleted} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /eliminar paquete/i }));
    await waitFor(() => expect(screen.getByText(/no tiene vuelta atrás/i)).toBeInTheDocument());
    expect(screen.getByText('Eventos: 1')).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Eliminar paquete' })).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(deletePackage).toHaveBeenCalledWith('910500'));
    expect(onDeleted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the delete action for staff (is_writer) and hides it for viewers', async () => {
    const staffUser = { ...adminUser, role: 'staff' as const };
    const { unmount } = render(<ShipmentDetail guia="910500" user={staffUser} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: /eliminar paquete/i })).toBeTruthy();
    unmount();

    const viewerUser = { ...adminUser, role: 'viewer' as const };
    render(<ShipmentDetail guia="910500" user={viewerUser} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /eliminar paquete/i })).toBeNull();
  });

  it('assigns a billing client to the package', async () => {
    const onChanged = vi.fn();
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} onChanged={onChanged} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByText(/Mock ClientSearch/));

    await waitFor(() => {
      expect(setPackageClient).toHaveBeenCalledWith('910500', 'client-1');
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it('shows the current service type and allows override', async () => {
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    // Current service type is displayed
    expect(screen.getByText(/Actual: Aéreo/)).toBeTruthy();

    // Override select is present
    const select = screen.getByDisplayValue('Base (Aéreo)');
    expect(select).toBeTruthy();
  });

  it('shows "Sin definir" for a manual package with no service type yet', async () => {
    vi.mocked(getPackageDetail).mockResolvedValue(detailWith({ service_type: null, service_type_override: null, effective_service_type: null }));
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    expect(screen.getByText(/Actual: Sin definir/)).toBeTruthy();
    expect(screen.getByDisplayValue('Base (sin definir)')).toBeTruthy();
  });

  it('prefills the assigned client in the search box', async () => {
    vi.mocked(getPackageDetail).mockResolvedValue(detailWith({ client_id: 'c1', billing_clients: { name: 'Ana Perez' } }));
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    expect(screen.getByText('Mock ClientSearch: Ana Perez')).toBeTruthy();
  });

  it('keeps the client search empty when no client is assigned', async () => {
    vi.mocked(getPackageDetail).mockResolvedValue(detailWith({}));
    render(<ShipmentDetail guia="910500" user={adminUser} onClose={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    expect(screen.getByText(/Mock ClientSearch: \(vacío\)/)).toBeTruthy();
  });
});
