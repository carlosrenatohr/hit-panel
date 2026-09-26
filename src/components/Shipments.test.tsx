import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact';
import Shipments from './Shipments';
import { listPackages, getProviders, createPackage, type ListFilters } from '../lib/insforge';
import { customerApi } from '../lib/customer';

// The create modal now requires a client (typed → created at submit) and a
// service type. Shared fixture for the shipped tests that reach the submit.
async function pickNewClientAndService() {
  fireEvent.input(screen.getByPlaceholderText(/Buscar cliente o escribir uno nuevo/), { target: { value: 'Ana P' } });
  fireEvent.mouseDown(await screen.findByText(/Crear cliente:/));
  fireEvent.change(screen.getByDisplayValue('Seleccionar…'), { target: { value: 'aereo' } });
}

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
  createPackage: vi.fn().mockResolvedValue({ id: 'p-1', almacen_id: '123', organization_id: 'hit' }),
}));

vi.mock('../lib/customer', () => ({
  customerApi: {
    list: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
    create: vi.fn().mockResolvedValue({ id: 'client-created-id', name: 'Nuevo Cliente' }),
  },
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

  it('applies the ?estado= status seed from the Dashboard drilldown on mount', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} statusSeed="entregado" />);

    await waitFor(() => {
      const calls = vi.mocked(listPackages).mock.calls.map((c) => c[0]);
      expect(calls.some((f) => f.status === 'entregado')).toBe(true);
    });
  });

  it('ignores a status seed that is not a canonical status', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} statusSeed="delivered" />);

    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThan(0));
    const calls = vi.mocked(listPackages).mock.calls.map((c) => c[0]);
    expect(calls.some((f) => f.status === 'delivered')).toBe(false);
  });

  it('filters by transport type when a tab is clicked', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /Aéreo/ }));

    await waitFor(() => {
      const calls = vi.mocked(listPackages).mock.calls.map((c) => c[0]);
      expect(calls.some((f) => f.service === 'aereo')).toBe(true);
    });
  });

  it('blocks creation with a hint when the agency has no provider', async () => {
    vi.mocked(getProviders).mockResolvedValue([]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));

    expect(screen.getByText(/todavía no tiene un proveedor asignado/)).toBeTruthy();
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25001234' } });
    const crear = screen.getByRole('button', { name: 'Crear' });
    expect((crear as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a chip (no select) for a single-provider agency and creates with it', async () => {
    vi.mocked(getProviders).mockResolvedValue([
      { id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true },
    ]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));

    const modal = screen.getByRole('heading', { name: 'Crear paquete manual' }).closest('.fixed') as HTMLElement;
    expect(within(modal).getByText('Global Connection')).toBeTruthy();
    // A chip is not a <select>: no display value is matchable.
    expect(within(modal).queryByDisplayValue('Global Connection')).toBeNull();

    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25009999' } });
    await pickNewClientAndService();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(expect.objectContaining({ providerCode: 'global_connection' }));
    });
  });

  it('preselects the default provider when the agency has several', async () => {
    vi.mocked(getProviders).mockResolvedValue([
      { id: 'e1', code: 'everest', name: 'Everest', isDefault: true },
      { id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: false },
    ]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));

    const select = screen.getByDisplayValue('Everest');
    expect((select as HTMLSelectElement).tagName).toBe('SELECT');
    fireEvent.change(select, { target: { value: 'global_connection' } });

    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25008888' } });
    await pickNewClientAndService();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(expect.objectContaining({ providerCode: 'global_connection' }));
    });
  });

  it('keeps the modal open and shows the warning on a tracking collision', async () => {
    vi.mocked(getProviders).mockResolvedValue([
      { id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true },
    ]);
    vi.mocked(createPackage).mockResolvedValueOnce({
      id: 'p-1', almacenId: '25007777', organizationId: 'original-express',
      warning: 'tracking 1Z9AA already exists in tenant hit',
    });
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25007777' } });
    await pickNewClientAndService();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(screen.getByText(/already exists in tenant hit/)).toBeTruthy());
    expect(screen.getByText('Crear paquete manual')).toBeTruthy();
  });

  it('shows the RPC message when creation is blocked cross-org', async () => {
    vi.mocked(getProviders).mockResolvedValue([
      { id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true },
    ]);
    vi.mocked(createPackage).mockRejectedValueOnce(new Error('guide 25006666 already exists in tenant hit — creation blocked'));
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25006666' } });
    await pickNewClientAndService();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(screen.getByText(/creation blocked/)).toBeTruthy());
    expect(screen.getByText('Crear paquete manual')).toBeTruthy();
  });

  it('blocks creation until a client and a service type are set', async () => {
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));

    // No guide, no client, no service → disabled.
    expect((screen.getByRole('button', { name: 'Crear' }) as HTMLButtonElement).disabled).toBe(true);

    // Guide filled, still no client and no service → disabled.
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25001299' } });
    expect((screen.getByRole('button', { name: 'Crear' }) as HTMLButtonElement).disabled).toBe(true);

    // Service chosen, still no client → disabled.
    fireEvent.change(screen.getByDisplayValue('Seleccionar…'), { target: { value: 'aereo' } });
    expect((screen.getByRole('button', { name: 'Crear' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('preselects en_almacen as the initial status', async () => {
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));

    // The status select shows the default label, not 'Seleccionar…'.
    expect(screen.getByDisplayValue('En bodega Miami')).toBeTruthy();
  });

  it('creates a new client first, then the package with status and service', async () => {
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));

    // Type a brand-new client name (≥3 chars) and pick "Crear cliente".
    fireEvent.input(screen.getByPlaceholderText(/Buscar cliente o escribir uno nuevo/), { target: { value: 'Ana P' } });
    const createOption = await screen.findByText(/Crear cliente:/);
    fireEvent.mouseDown(createOption);

    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25001234' } });
    fireEvent.change(screen.getByDisplayValue('Seleccionar…'), { target: { value: 'aereo' } });
    // A date entered in the modal must keep its calendar day (local midnight),
    // not fall a day behind by parsing as UTC midnight.
    fireEvent.change(screen.getByLabelText('Fecha de recepción (opcional)'), { target: { value: '2026-09-23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(vi.mocked(customerApi.create)).toHaveBeenCalledWith({ name: 'Ana P' }));
    await waitFor(() =>
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(
        expect.objectContaining({ almacenId: '25001234', clientId: 'client-created-id', status: 'en_almacen', serviceType: 'aereo', receivedAt: expect.stringMatching(/^2026-09-23T/) }),
      ),
    );
  });

  it('links an existing tenant client instead of creating one', async () => {
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    vi.mocked(customerApi.list).mockResolvedValue({
      rows: [{ id: 'c1', name: 'Ana Perez', nameNormalized: 'ana perez', casillero: null, toReview: false, email: null, phone: null, address: null, defaultRateId: null, defaultRateCardId: null }],
      count: 1,
    });
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Buscar cliente o escribir uno nuevo/), { target: { value: 'ana' } });
    fireEvent.mouseDown(await screen.findByText('Ana Perez'));

    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25004444' } });
    fireEvent.change(screen.getByDisplayValue('Seleccionar…'), { target: { value: 'maritimo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() =>
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c1', serviceType: 'maritimo' })),
    );
    expect(vi.mocked(customerApi.create)).not.toHaveBeenCalled();
  });
});
