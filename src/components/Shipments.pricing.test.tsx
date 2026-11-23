import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact';
import Shipments from './Shipments';

// Flexible pricing (suite-only): the create-package modal prices BOTH billing
// types — weight (price/lb × weight) and fixed (flat per guía) — and the summary
// is shared wording (Utilidad, never "Margen bruto" or "Worker").

const pricingPreview = vi.hoisted(() => vi.fn());
const createPackage = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'p-1', almacen_id: '25001234', organization_id: 'suite' }));

vi.mock('../lib/insforge', () => ({
  listPackages: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
  getProviders: vi.fn().mockResolvedValue([{ id: 'g1', code: 'global_connection', name: 'Global Connection', isDefault: true }]),
  getTagsForPackages: vi.fn().mockResolvedValue({}),
  exportPackages: vi.fn().mockResolvedValue([]),
  createPackage,
}));

vi.mock('../lib/customer', () => ({
  customerApi: {
    list: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
    create: vi.fn().mockResolvedValue({ id: 'client-created-id', name: 'Nuevo Cliente' }),
  },
}));

vi.mock('../lib/config', () => ({
  configApi: {
    features: vi.fn().mockResolvedValue({ flexiblePricing: true }),
    listRateCards: vi.fn().mockResolvedValue({
      organizationId: 'suite',
      cards: [
        { id: 'fixed-1', name: 'Documentos', pricingKind: 'fixed', currentVersion: { entries: [] } },
      ],
    }),
  },
}));

vi.mock('../lib/billing', () => ({
  billingApi: {
    pricingPreview,
    bulkPreview: vi.fn(),
    bulkCreate: vi.fn(),
  },
}));

const adminUser = { id: 'u-1', email: 'admin@suite.test', role: 'admin' as const, name: 'Admin', agency: 'suite' as const };

async function openAndFill() {
  fireEvent.click(await screen.findByRole('button', { name: 'Crear paquete' }));
  fireEvent.input(screen.getByPlaceholderText(/Ej: 25001234/), { target: { value: '25001234' } });
  fireEvent.input(screen.getByPlaceholderText(/Buscar cliente o escribir uno nuevo/), { target: { value: 'Ana P' } });
  fireEvent.mouseDown(await screen.findByText(/Crear cliente:/));
}

describe('Shipments create modal — flexible pricing summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for the billing type before the service and prices a weight package', async () => {
    pricingPreview.mockResolvedValue({
      cardName: 'Estándar',
      pricingKind: 'weight',
      customerCharge: 35,
      customerRate: 7,
      customerUnit: 'lb',
      currency: 'USD',
      quantity: 5,
      providerCost: 22.5,
      grossProfit: 12.5,
    });
    render(<Shipments user={adminUser} onOpen={() => {}} />);
    await openAndFill();

    const tipoTarifa = screen.getByLabelText('Tipo de tarifa');
    const tipoServicio = screen.getByLabelText('Tipo de servicio (obligatorio)');
    expect(tipoTarifa.compareDocumentPosition(tipoServicio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(tipoServicio, { target: { value: 'aereo' } });
    fireEvent.input(screen.getByPlaceholderText('0.0'), { target: { value: '5' } });

    await waitFor(() =>
      expect(pricingPreview).toHaveBeenCalledWith(expect.objectContaining({ serviceType: 'aereo', pricingKind: 'weight', weightLb: 5 })),
    );
    const summary = await screen.findByText('Resumen de cobro');
    const card = summary.closest('div')!.parentElement as HTMLElement;
    expect(within(card).getByText('Estándar')).toBeTruthy();
    expect(within(card).getByText(/\$35\.00/)).toBeTruthy();
    expect(within(card).getByText('Utilidad')).toBeTruthy();
    expect(within(card).queryByText(/Margen bruto/)).toBeNull();
    expect(within(card).queryByText(/Worker/)).toBeNull();
  });

  it('prices a fixed-fee package with the picked card and sends it on create', async () => {
    pricingPreview.mockResolvedValue({
      cardName: 'Documentos',
      pricingKind: 'fixed',
      customerCharge: 25,
      customerUnit: 'package',
      currency: 'USD',
      quantity: 1,
      providerCost: 8,
      grossProfit: 17,
    });
    render(<Shipments user={adminUser} onOpen={() => {}} />);
    await openAndFill();

    fireEvent.change(screen.getByLabelText('Tipo de tarifa'), { target: { value: 'fixed' } });
    fireEvent.change(screen.getByLabelText('Tipo de servicio (obligatorio)'), { target: { value: 'aereo' } });
    // A single fixed card is preselected so the summary resolves immediately.
    await waitFor(() =>
      expect(pricingPreview).toHaveBeenCalledWith(expect.objectContaining({ pricingKind: 'fixed', rateCardId: 'fixed-1' })),
    );
    expect(await screen.findByText('1 guía')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() =>
      expect(createPackage).toHaveBeenCalledWith(expect.objectContaining({ rateCardId: 'fixed-1', serviceType: 'aereo' })),
    );
  });

  it('requires a fixed card before creating a fixed-fee package', async () => {
    pricingPreview.mockResolvedValue({
      cardName: 'Documentos', pricingKind: 'fixed', customerCharge: 25, customerUnit: 'package', currency: 'USD', quantity: 1,
    });
    render(<Shipments user={adminUser} onOpen={() => {}} />);
    await openAndFill();

    // Wait for the fixed cards to load before switching (the option is disabled
    // until the agency's fixed tariffs arrive).
    await waitFor(() => expect((screen.getByRole('option', { name: 'Cuota fija' }) as HTMLOptionElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Tipo de tarifa'), { target: { value: 'fixed' } });
    fireEvent.change(screen.getByLabelText('Tipo de servicio (obligatorio)'), { target: { value: 'aereo' } });
    fireEvent.change(await screen.findByLabelText(/Tarifa de cuota fija/), { target: { value: '' } });

    expect((screen.getByRole('button', { name: 'Crear' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
