import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import Overview from './Overview';

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
}));

const mockUser = { id: 'u-1', email: 'admin@hit-cargo.com', role: 'admin' as const, name: 'Admin', agency: 'hit' as const };

describe('Overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the overview dashboard with stats', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Resumen')).toBeTruthy();
    });

    expect(screen.getAllByText(/150/).length).toBeGreaterThan(0);
  });

  it('shows loading spinner initially', () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} />);
    expect(screen.getByText(/Cargando/)).toBeTruthy();
  });

  it('displays provider information', async () => {
    render(<Overview user={mockUser} onOpen={() => {}} onGoShipments={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText('Everest').length).toBeGreaterThan(0);
    });
  });
});
