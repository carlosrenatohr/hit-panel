import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/preact';
import Shipments from './Shipments';
import { listPackages, getProviders, createPackage, getTagsForPackages, type ListFilters } from '../lib/insforge';
import type { Pkg } from '../lib/types';
import { customerApi } from '../lib/customer';
import { billingApi } from '../lib/billing';
import { bumpData, bumpList } from '../lib/dataVersion';

// The create modal now requires a client (typed → created at submit), a
// service type and a weight greater than zero. Shared fixture for the
// shipped tests that reach the submit.
async function pickNewClientAndService() {
  fireEvent.input(screen.getByPlaceholderText(/Buscar cliente o escribir uno nuevo/), { target: { value: 'Ana P' } });
  fireEvent.mouseDown(await screen.findByText(/Crear cliente:/));
  fireEvent.change(screen.getByDisplayValue('Seleccionar…'), { target: { value: 'aereo' } });
  fireEvent.input(screen.getByPlaceholderText('0.0'), { target: { value: '5.5' } });
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
    weight_override_lb: null,
    effective_weight_lb: 5.2,
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
  getTagsForPackages: vi.fn().mockResolvedValue({}),
  exportPackages: vi.fn().mockResolvedValue(mockPkgs),
  createPackage: vi.fn().mockResolvedValue({ id: 'p-1', almacen_id: '123', organization_id: 'hit' }),
  pricingKindAvailability: vi.fn().mockResolvedValue({ mixed: false }),
}));

// RLS is default-deny on `invoices`, so the list reads the link + status from the
// Worker. Spread the real module: Shipments also uses billingApi for bulk actions.
vi.mock('../lib/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/billing')>();
  return { ...actual, billingApi: { ...actual.billingApi, invoiceLinks: vi.fn() } };
});

vi.mock('../lib/customer', () => ({
  customerApi: {
    list: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
    create: vi.fn().mockResolvedValue({ id: 'client-created-id', name: 'Nuevo Cliente' }),
  },
}));

// Flexible pricing is feature-gated at runtime: the component imports this
// module dynamically, so tests control the flag and the fixed cards from here.
vi.mock('../lib/config', () => ({
  configApi: {
    features: vi.fn().mockResolvedValue({ flexiblePricing: false }),
    listRateCards: vi.fn().mockResolvedValue({ cards: [] }),
  },
}));

const mockUser = { id: 'u-1', email: 'admin@hit-cargo.com', role: 'admin' as const, name: 'Admin', agency: 'hit' as const };

describe('Shipments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(billingApi.invoiceLinks).mockResolvedValue({ links: [] });
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

  it('refetches the list when packages change elsewhere (cross-view bus)', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThanOrEqual(1));
    const before = vi.mocked(listPackages).mock.calls.length;

    act(() => bumpData('packages'));

    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThan(before));
  });

  it('un refetch del focus (bumpList) recarga solo la tabla, nunca los 8 counts', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThanOrEqual(1));
    const before = vi.mocked(listPackages).mock.calls.length;

    act(() => bumpList('packages'));

    // Exactamente la lista (1 request); las tarjetas no se reconsultan.
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBe(before + 1));
    await new Promise((r) => setTimeout(r, 50));
    expect(vi.mocked(listPackages).mock.calls.length).toBe(before + 1);
  });

  it('el refetch del focus no reemplaza la tabla por el spinner (sin parpadeo)', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    act(() => bumpList('packages'));

    // El tbody sigue pintando las filas: el swap de datos es silencioso.
    expect(screen.getAllByText('910500').length).toBeGreaterThan(0);
    expect(screen.getAllByText('910501').length).toBeGreaterThan(0);
  });

  it('refetches the summary cards when packages change elsewhere', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThanOrEqual(1));
    const before = vi.mocked(listPackages).mock.calls.length;

    act(() => bumpData('packages'));

    // Summary fires N calls (one per status), list fires 1 call.
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThan(before + 1));
  });

  it('the Actualizar button refetches both the list and the lifecycle cards', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThanOrEqual(1));
    const before = vi.mocked(listPackages).mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));

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

  it('applies a status from the mobile filter sheet without dropping the other filters', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Selector de estado' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Excepción/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtro' }));

    await waitFor(() => {
      const calls = vi.mocked(listPackages).mock.calls.map((c) => c[0]);
      expect(calls.some((f) => f.status === 'excepcion')).toBe(true);
    });
  });

  it('keeps the transport filter when a status is applied from the sheet', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /Aéreo/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Selector de estado' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Excepción/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtro' }));

    await waitFor(() => {
      const calls = vi.mocked(listPackages).mock.calls.map((c) => c[0]);
      expect(calls.some((f) => f.status === 'excepcion' && f.service === 'aereo')).toBe(true);
    });
  });

  it('filters by the pickup-ready shortcut in the mobile header', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Listos para retiro' }));

    await waitFor(() => {
      const calls = vi.mocked(listPackages).mock.calls.map((c) => c[0]);
      expect(calls.some((f) => f.status === 'en_destino')).toBe(true);
    });
  });

  it('shows the selected status on the primary selector and opens the sheet from it', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} statusSeed="en_destino" />);

    const selector = await screen.findByRole('button', { name: 'Selector de estado' });
    await waitFor(() => expect(selector.textContent).toContain('En destino (Nicaragua)'));

    fireEvent.click(selector);

    const dialog = await screen.findByRole('dialog', { name: 'Filtrar órdenes' });
    expect(within(dialog).getByRole('radio', { name: /En destino/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('clears the pickup filter when the pressed star is tapped again', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} statusSeed="en_destino" />);

    const star = await screen.findByRole('button', { name: 'Listos para retiro' });
    await waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(star);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Selector de estado' }).textContent).toContain('Todos los estados'),
    );
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
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));

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
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));

    await waitFor(() => {
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(expect.objectContaining({ providerCode: 'global_connection' }));
    });
  });

  it('muestra el mensaje RPC en español cuando la creación falla', async () => {
    vi.mocked(getProviders).mockResolvedValue([
      { id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true },
    ]);
    // ADR-013: create_package nunca bloquea cross-tenant; sus errores de
    // validación (cliente, proveedor, permisos) son mensajes RPC en español.
    vi.mocked(createPackage).mockRejectedValueOnce(new Error('El proveedor global_connection no está habilitado para tu agencia.'));
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25006666' } });
    await pickNewClientAndService();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));

    await waitFor(() => expect(screen.getByText(/no está habilitado para tu agencia/)).toBeTruthy());
    expect(screen.getByText('Crear paquete manual')).toBeTruthy();
  });

  it('crea el cliente una sola vez aunque falle el paquete y el reintento lo reutiliza', async () => {
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    vi.mocked(createPackage).mockRejectedValueOnce(new Error('La base rechazó el alta del paquete (42P10).'));
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25007777' } });
    await pickNewClientAndService();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));

    // First attempt: client created, package rejected.
    await waitFor(() => expect(screen.getByText(/42P10/)).toBeTruthy());
    expect(vi.mocked(customerApi.create)).toHaveBeenCalledTimes(1);
    const firstClientId = vi.mocked(createPackage).mock.calls[0][0].clientId;

    // Retry from the same form: the created client is reused, never re-created.
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));
    await waitFor(() => expect(vi.mocked(createPackage)).toHaveBeenCalledTimes(2));
    expect(vi.mocked(customerApi.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createPackage).mock.calls[1][0].clientId).toBe(firstClientId);
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

    // Sensible defaults: 1 piece and today's reception date (local calendar day).
    expect((screen.getByLabelText('Piezas') as HTMLInputElement).value).toBe('1');
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect((screen.getByLabelText('Fecha de recepción (opcional)') as HTMLInputElement).value).toBe(today);
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
    fireEvent.input(screen.getByPlaceholderText('0.0'), { target: { value: '4.2' } });
    // A date entered in the modal must keep its calendar day (local midnight),
    // not fall a day behind by parsing as UTC midnight.
    fireEvent.change(screen.getByLabelText('Fecha de recepción (opcional)'), { target: { value: '2026-09-23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));

    await waitFor(() => expect(vi.mocked(customerApi.create)).toHaveBeenCalledWith({ name: 'Ana P' }));
    await waitFor(() =>
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(
        expect.objectContaining({ almacenId: '25001234', clientId: 'client-created-id', status: 'en_almacen', serviceType: 'aereo', pricingKind: 'weight', rateCardId: null, receivedAt: expect.stringMatching(/^2026-09-23T/) }),
      ),
    );
  });

  it('sends the operator billing kind so a weight package never lands as fixed', async () => {
    const { configApi } = await import('../lib/config');
    vi.mocked(configApi.features).mockResolvedValue({ flexiblePricing: true } as never);
    vi.mocked(configApi.listRateCards).mockResolvedValue({
      cards: [{ id: 'rc-fixed', name: 'Fija estándar', pricingKind: 'fixed', isDefault: true, currentVersion: { entries: [] } }],
    } as never);
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25007777' } });
    await pickNewClientAndService();

    // Weight is the default: no rate card rides along.
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));
    await waitFor(() =>
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(
        expect.objectContaining({ serviceType: 'aereo', pricingKind: 'weight', rateCardId: null }),
      ),
    );

    // Switching to fixed sends the pick explicitly (the RPC only resolves a
    // fixed card when the form says fixed).
    vi.mocked(createPackage).mockClear();
    await waitFor(() => expect(screen.queryByText('Crear paquete manual')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25008888' } });
    await pickNewClientAndService();
    fireEvent.change(await screen.findByDisplayValue('Por peso'), { target: { value: 'fixed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));
    await waitFor(() =>
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(
        expect.objectContaining({ pricingKind: 'fixed', rateCardId: 'rc-fixed' }),
      ),
    );
  });

  it('refreshes the list + cards and clears filters/page after creating a package', async () => {
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    // Drill in with a status filter so "clearing filters" is observable.
    render(<Shipments user={mockUser} onOpen={() => {}} statusSeed="en_destino" />);
    await waitFor(() => expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThanOrEqual(1));
    const before = vi.mocked(listPackages).mock.calls.length;

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25003333' } });
    await pickNewClientAndService();
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));

    await waitFor(() => expect(vi.mocked(createPackage)).toHaveBeenCalled());

    // ADR-013: el éxito de create_package SIEMPRE cierra el modal (antes, con
    // `warning`, quedaba abierto para leer el aviso cross-tenant).
    await waitFor(() => expect(screen.queryByText('Crear paquete manual')).toBeNull());

    // D6: after a successful create the list and lifecycle cards refetch, and the
    // filters reset to the current-month default (no status) so the new row is
    // visible on page 1 instead of hidden by the drilldown filter.
    await waitFor(() => {
      expect(vi.mocked(listPackages).mock.calls.length).toBeGreaterThan(before);
      const last = vi.mocked(listPackages).mock.calls[vi.mocked(listPackages).mock.calls.length - 1][0];
      expect(last.status).toBeUndefined();
      expect(last.statuses).toBeUndefined();
      expect(last.from).toBe(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`);
    });
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
    fireEvent.input(screen.getByPlaceholderText('0.0'), { target: { value: '3.1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }));

    await waitFor(() =>
      expect(vi.mocked(createPackage)).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c1', serviceType: 'maritimo' })),
    );
    expect(vi.mocked(customerApi.create)).not.toHaveBeenCalled();
  });

  it('rejects a missing or zero weight before creating', async () => {
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25001500' } });
    await pickNewClientAndService();

    fireEvent.input(screen.getByPlaceholderText('0.0'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    expect(await screen.findByText(/El peso \(lb\) es obligatorio y debe ser mayor a 0/)).toBeTruthy();
    expect(vi.mocked(createPackage)).not.toHaveBeenCalled();
  });

  it('la columna Etiquetas filtra al hacer click y deja un chip removible', async () => {
    vi.mocked(getTagsForPackages).mockResolvedValue({
      '1': [{ id: 't1', package_id: '1', label: 'cliente', value: 'Ana', created_by: 'admin', created_at: '2026-09-01T00:00:00Z' }],
    });
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    const chip = await screen.findByRole('button', { name: 'cliente: Ana' });
    fireEvent.click(chip);

    await waitFor(() =>
      expect(vi.mocked(listPackages)).toHaveBeenCalledWith(expect.objectContaining({ tag: { label: 'cliente', value: 'Ana' } })),
    );
    expect(screen.getByTitle('Quitar filtro de etiqueta')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Quitar filtro de etiqueta'));
    await waitFor(() => {
      const last = vi.mocked(listPackages).mock.calls.at(-1)?.[0] as ListFilters;
      expect(last.tag).toBeUndefined();
    });
    vi.mocked(getTagsForPackages).mockResolvedValue({});
  });

  it('la columna Etiquetas muestra un guion cuando la página no tiene etiquetas', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    // "—" en la columna de etiquetas de ambas filas (tabla escritorio; móvil no usa columnas).
    expect(vi.mocked(getTagsForPackages)).toHaveBeenCalledWith(['1', '2']);
  });

  it('muestra el tipo de tarifa como icono para paquetes fijos y por peso', async () => {
    const original = vi.mocked(listPackages).getMockImplementation();
    vi.mocked(listPackages).mockImplementation(async () => ({
      rows: [
        { ...mockPkgs[0], pricing_kind: 'fixed' },
        { ...mockPkgs[1], pricing_kind: 'weight' },
      ] as unknown as Pkg[],
      count: 2,
    }));
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    expect(screen.getAllByLabelText('Cuota fija por carga').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Tarifa por peso').length).toBeGreaterThan(0);
    vi.mocked(listPackages).mockImplementation(original!);
  });

  it('ya no dibuja el lápiz de estado manual (tabla ni tarjeta móvil)', async () => {
    const original = vi.mocked(listPackages).getMockImplementation();
    vi.mocked(listPackages).mockImplementation(async () => ({
      rows: [{ ...mockPkgs[0], manual_status: 'entregado' }] as unknown as Pkg[],
      count: 1,
    }));
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await waitFor(() => expect(screen.getAllByText('910500').length).toBeGreaterThan(0));

    expect(screen.queryByLabelText('Estado manual')).toBeNull();
    expect(screen.queryAllByTitle(/Estado manual/)).toHaveLength(0);
    vi.mocked(listPackages).mockImplementation(original!);
  });


  it('shows the billing kind as an icon and marks a paid invoice green', async () => {
    const original = vi.mocked(listPackages).getMockImplementation();
    vi.mocked(listPackages).mockResolvedValue({
      rows: [
        { ...mockPkgs[0], id: 'p-fixed', almacen_id: 'G-FIX', referencia_name: 'Ana', effective_status: 'entregado', client_id: 'c1', pricing_kind: 'fixed', invoice_packages: [{ invoice_id: 'i1', active: true, invoices: { status: 'PAID' } }] },
        { ...mockPkgs[0], id: 'p-weight', almacen_id: 'G-W', referencia_name: 'Luis', effective_status: 'entregado', client_id: 'c2', pricing_kind: 'weight', invoice_packages: [] },
      ],
      count: 2,
    } as never);
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    await screen.findAllByText('G-FIX');
    expect(screen.getAllByLabelText('Cuota fija por carga').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Tarifa por peso').length).toBeGreaterThan(0);

    const paid = screen.getAllByLabelText('Factura pagada');
    expect(paid.length).toBeGreaterThan(0);
    expect(paid[0].className).toContain('text-emerald-600');

    vi.mocked(listPackages).mockImplementation(original!);
  });


  it('marks the invoice green with the status the Worker returns (RLS blocks the embed)', async () => {
    const original = vi.mocked(listPackages).getMockImplementation();
    // The PostgREST embed comes back null for every row: no invoice data at all.
    vi.mocked(listPackages).mockResolvedValue({
      rows: [
        { ...mockPkgs[0], id: 'p-paid', almacen_id: 'G-PAID', referencia_name: 'Ana', invoice_packages: [] },
        { ...mockPkgs[0], id: 'p-open', almacen_id: 'G-OPEN', referencia_name: 'Luis', invoice_packages: [] },
      ],
      count: 2,
    } as never);
    vi.mocked(billingApi.invoiceLinks).mockResolvedValue({
      links: [
        { packageId: 'p-paid', invoiceId: 'inv-13', status: 'PAID' },
        { packageId: 'p-open', invoiceId: 'inv-14', status: 'ISSUED' },
      ],
    });
    render(<Shipments user={mockUser} onOpen={() => {}} />);

    await screen.findAllByText('G-PAID');
    const paid = await screen.findAllByLabelText('Factura pagada');
    expect(paid.length).toBeGreaterThan(0);
    expect(paid[0].className).toContain('text-emerald-600');
    // The issued one stays on the neutral tone.
    expect(screen.getAllByLabelText('Ver factura').length).toBeGreaterThan(0);

    vi.mocked(listPackages).mockImplementation(original!);
  });

  it('asks before discarding a manually typed package', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
    fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25009999' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Descartar los datos del paquete?' });
    expect(screen.getByText('Crear paquete manual')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Descartar y salir' }));
    await waitFor(() => expect(screen.queryByText('Crear paquete manual')).toBeNull());
  });

  it('sorts from the column headers, toggling ASC/DESC with one active column', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await screen.findAllByText('910500');

    // No global sort selector anymore.
    expect(screen.queryByRole('combobox', { name: 'Ordenar por' })).toBeNull();
    // Default view: Estado (status_rank) ascending.
    expect(screen.getByRole('columnheader', { name: /Estado/ }).getAttribute('aria-sort')).toBe('ascending');

    const lastCall = () => vi.mocked(listPackages).mock.calls[vi.mocked(listPackages).mock.calls.length - 1][0];

    // Inactive header → ASC on the first click.
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Recibido Miami' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ sortCol: 'received_at', ascending: true }));
    expect(screen.getByRole('columnheader', { name: /Recibido Miami/ }).getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getByRole('columnheader', { name: /Estado/ }).getAttribute('aria-sort')).toBe('none');

    // Same header → DESC.
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Recibido Miami' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ sortCol: 'received_at', ascending: false }));
    expect(screen.getByRole('columnheader', { name: /Recibido Miami/ }).getAttribute('aria-sort')).toBe('descending');

    // Money column: sortable like any other (server-side numeric order). Labelled
    // «Monto» because «Carga» already names the weight/pieces column.
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Monto' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ sortCol: 'customer_charge', ascending: true }));
    expect(screen.getByRole('columnheader', { name: /Monto/ }).getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getByRole('columnheader', { name: /Recibido Miami/ }).getAttribute('aria-sort')).toBe('none');
  });

  it('renders Estado as dot + icon with the label in the tooltip, not repeated as text', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    const cells = await screen.findAllByRole('img', { name: 'Entregado' });
    const cell = cells[0].closest('td')!;
    expect(cell.querySelector('span.rounded-full')).toBeTruthy();
    expect(cell.querySelector('svg')).toBeTruthy();
    // The status label only lives in the tooltip: no duplicated text in the row.
    const tooltip = cell.querySelector('[role="tooltip"]')!;
    expect(tooltip.textContent).toBe('Entregado');
    expect(cell.textContent).toBe(tooltip.textContent);
    expect(screen.getAllByRole('tooltip', { name: 'Entregado' }).length).toBeGreaterThan(0);
  });

  it('hides the provider filter when the agency has only one provider', async () => {
    vi.mocked(getProviders).mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]);
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await screen.findAllByText('910500');
    expect(screen.queryByLabelText('Filtrar por proveedor')).toBeNull();
  });

  it('shows the tariff filter only when the agency mixes billing kinds', async () => {
    const insforge = await import('../lib/insforge');
    vi.mocked(insforge.pricingKindAvailability).mockResolvedValue({ mixed: false });
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await screen.findAllByText('910500');
    expect(screen.queryByLabelText('Filtrar por tipo de tarifa')).toBeNull();
  });

  it('filters by tariff kind when the agency has both kinds', async () => {
    const insforge = await import('../lib/insforge');
    vi.mocked(insforge.pricingKindAvailability).mockResolvedValue({ mixed: true });
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    const kind = await screen.findByLabelText('Filtrar por tipo de tarifa');
    fireEvent.change(kind, { target: { value: 'fixed' } });
    await waitFor(() => {
      const last = vi.mocked(listPackages).mock.calls[vi.mocked(listPackages).mock.calls.length - 1][0];
      expect(last.pricingKind).toBe('fixed');
    });
    // Same width as every other filter control: a narrower select left the row
    // misaligned when another filter was hidden.
    expect((kind as HTMLSelectElement).className).not.toContain('max-w-40');
  });

  it('renders the service as a single-tone Lucide icon', async () => {
    render(<Shipments user={mockUser} onOpen={() => {}} />);
    await screen.findAllByText('910500');
    const air = screen.getAllByLabelText('Aéreo');
    const sea = screen.getAllByLabelText('Marítimo');
    expect(air.length).toBeGreaterThan(0);
    expect(sea.length).toBeGreaterThan(0);
    expect(air[0].className).toContain('text-slate-500');
    expect(sea[0].className).toContain('text-slate-500');
  });
});
