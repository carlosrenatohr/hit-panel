import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact';
import Overview from './Overview';
import { getStats } from '../lib/insforge';

const mockStats = vi.hoisted(() => ({
  total: 150,
  by_status: {
    en_almacen: 45,
    en_transito: 30,
    en_destino: 20,
    entregado: 40,
    excepcion: 10,
    parcial: 3,
    desconocido: 2,
  },
  by_provider: {
    everest: 100,
    gc: 50,
  },
  last_scraped: {
    everest: '2026-08-04T08:00:00Z',
    gc: '2026-08-04T07:30:00Z',
  },
  delivered_30d: 35,
}));

const mockProviders = vi.hoisted(() => [
  { id: 'prov-1', code: 'everest', name: 'Everest' },
  { id: 'prov-2', code: 'gc', name: 'Global Connection' },
]);

vi.mock('../lib/insforge', () => ({
  getStats: vi.fn().mockResolvedValue(mockStats),
  getProviders: vi.fn().mockResolvedValue(mockProviders),
  getUnassignedPackages: vi.fn().mockResolvedValue({ count: 0, sample: [] }),
}));

const mockUser = { id: 'u-1', email: 'admin@hit-cargo.com', role: 'admin' as const, name: 'Admin', agency: 'hit' as const };

const onGoStatus = vi.fn();

describe('Overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the overview dashboard with stats', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} onGoUnassigned={() => {}} onGoStatus={onGoStatus} />);

    await waitFor(() => {
      expect(screen.getByText('Resumen')).toBeTruthy();
    });

    expect(screen.getAllByText(/150/).length).toBeGreaterThan(0);
  });

  it('shows loading spinner initially', () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} onGoUnassigned={() => {}} onGoStatus={onGoStatus} />);
    expect(screen.getByText(/Cargando/)).toBeTruthy();
  });

  it('displays provider information', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} onGoUnassigned={() => {}} onGoStatus={onGoStatus} />);

    await waitFor(() => {
      expect(screen.getAllByText('Everest').length).toBeGreaterThan(0);
    });
  });

  it('shows a share percentage on every status bar', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} onGoUnassigned={() => {}} onGoStatus={onGoStatus} />);

    // 45/150, 30/150 and 40/150 rounded like Reports' Trend does
    await waitFor(() => expect(screen.getByText('30%')).toBeTruthy());
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.getByText('27%')).toBeTruthy();
    expect(screen.getByText('% del total de paquetes en el rango.')).toBeTruthy();
  });

  it('shows each provider share over the provider total', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} onGoUnassigned={() => {}} onGoStatus={onGoStatus} />);

    await waitFor(() => expect(screen.getByText('67% del total')).toBeTruthy());
    expect(screen.getByText('33% del total')).toBeTruthy();
  });

  it('drills down into Paquetería when a status bar is clicked', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} onGoUnassigned={() => {}} onGoStatus={onGoStatus} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ver En destino (Nicaragua) en Paquetería' }));
    expect(onGoStatus).toHaveBeenCalledWith('en_destino');
  });

  it('surfaces exceptions and pickup-ready packages as actions', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} onGoUnassigned={() => {}} onGoStatus={onGoStatus} />);

    await waitFor(() => expect(screen.getByText('10 excepciones para revisar')).toBeTruthy());
    expect(screen.getByText('20 listos para retiro')).toBeTruthy();

    const actions = within(screen.getByLabelText('Requiere acción')).getAllByRole('button');
    fireEvent.click(actions[0]);
    expect(onGoStatus).toHaveBeenCalledWith('excepcion');
    fireEvent.click(actions[1]);
    expect(onGoStatus).toHaveBeenCalledWith('en_destino');
  });

  it('hides status percentages while a status filter is active', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} onGoUnassigned={() => {}} onGoStatus={onGoStatus} />);
    await waitFor(() => expect(screen.getByText('30%')).toBeTruthy());

    // dashboard_stats narrows total to p_status, so the ratio would be meaningless
    vi.mocked(getStats).mockResolvedValue({
      ...mockStats,
      total: 40,
      by_status: { entregado: 40 },
      by_provider: { everest: 40 },
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'entregado' } });

    await waitFor(() => expect(screen.queryByText('30%')).toBeNull());
    expect(screen.queryByText('% del total de paquetes en el rango.')).toBeNull();
    vi.mocked(getStats).mockResolvedValue(mockStats);
  });
});
