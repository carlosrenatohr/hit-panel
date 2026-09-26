import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { PickupQuickAction, StatusSelector } from './LifecycleOverview';
import FilterSheet from './FilterSheet';
import type { ShipmentStatus } from '../../lib/types';

const counts: Partial<Record<ShipmentStatus, number>> = {
  en_almacen: 3,
  parcial: 1,
  en_transito: 1,
  en_destino: 2,
  entregado: 4,
  excepcion: 0,
  desconocido: 0,
};

describe('StatusSelector', () => {
  it('shows every state under one selector: "Todos los estados" with the unpredicated total', () => {
    render(<StatusSelector counts={counts} total={11} loading={false} activeStatus={undefined} onOpen={() => {}} />);

    const btn = screen.getByRole('button', { name: 'Selector de estado' });
    expect(btn.textContent).toContain('Todos los estados');
    expect(btn.textContent).toContain('11');
  });

  it('renders the selected canonical status with its own count back on the main screen', () => {
    render(<StatusSelector counts={counts} total={11} loading={false} activeStatus="en_destino" onOpen={() => {}} />);

    const btn = screen.getByRole('button', { name: 'Selector de estado' });
    expect(btn.textContent).toContain('En destino (Nicaragua)');
    expect(btn.textContent).toContain('2');
  });

  it('opens the full bottom-sheet selector on tap', () => {
    const onOpen = vi.fn();
    render(<StatusSelector counts={counts} total={11} loading={false} activeStatus="excepcion" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Selector de estado' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('falls back to zero for a selected status without data', () => {
    render(<StatusSelector counts={{}} total={11} loading={false} activeStatus="parcial" onOpen={() => {}} />);

    expect(screen.getByRole('button', { name: 'Selector de estado' }).textContent).toContain('0');
  });
});

describe('PickupQuickAction', () => {
  it('shows the pickup count and fires on tap', () => {
    const onClick = vi.fn();
    render(<PickupQuickAction count={2} loading={false} active={false} onClick={onClick} />);

    const btn = screen.getByRole('button', { name: 'Listos para retiro' });
    expect(btn.textContent).toContain('2');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks itself pressed while the pickup filter is active', () => {
    render(<PickupQuickAction count={2} loading={false} active onClick={() => {}} />);

    expect(screen.getByRole('button', { name: 'Listos para retiro' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('FilterSheet', () => {
  const sheet = (props: Partial<Parameters<typeof FilterSheet>[0]> = {}) => (
    <FilterSheet
      open
      onClose={() => {}}
      counts={counts}
      total={11}
      loading={false}
      activeStatus={undefined}
      onApply={() => {}}
      {...props}
    />
  );

  it('lists Todos and the seven canonical states with their counts', () => {
    render(sheet());

    expect(screen.getAllByRole('radio')).toHaveLength(8);
    expect(screen.getByRole('radio', { name: /En bodega Miami/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('En destino (Nicaragua)')).toBeTruthy();
    expect(screen.getByText('Todos')).toBeTruthy();
    expect(screen.getByText('Excepción')).toBeTruthy();
  });

  it('writes the selection only when Aplicar filtro is pressed', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(sheet({ onApply, onClose }));

    fireEvent.click(screen.getByRole('radio', { name: /En bodega Miami/ }));
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtro' }));
    expect(onApply).toHaveBeenCalledWith('en_almacen');
    expect(onClose).toHaveBeenCalled();
  });

  it('clears the status when Todos is chosen', () => {
    const onApply = vi.fn();
    render(sheet({ onApply }));

    fireEvent.click(screen.getByRole('radio', { name: /^Todos/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtro' }));
    expect(onApply).toHaveBeenCalledWith(undefined);
  });

  it('re-seeds the draft from the applied filter every time it opens', () => {
    const { rerender } = render(sheet({ activeStatus: undefined, onApply: () => {} }));

    fireEvent.click(screen.getByRole('radio', { name: /En tránsito/ }));
    rerender(sheet({ open: false, activeStatus: undefined }));
    rerender(sheet({ open: true, activeStatus: undefined }));

    expect(screen.getByRole('radio', { name: /En tránsito/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: /^Todos/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(sheet({ onClose }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
