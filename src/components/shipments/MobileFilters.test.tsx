import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { StatusChips } from './LifecycleOverview';
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

const chips = (props: Partial<Parameters<typeof StatusChips>[0]> = {}) => (
  <StatusChips counts={counts} total={11} loading={false} onStatusChange={() => {}} {...props} />
);

describe('StatusChips', () => {
  it('renders Todos plus every canonical status with its count', () => {
    render(chips());

    expect(screen.getByRole('button', { name: 'Todos 11' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bodega 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Parcial 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tránsito 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Destino 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entregado 4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excepción 0' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desconocido 0' })).toBeTruthy();
  });

  it('toggles the canonical status on click', () => {
    const onStatusChange = vi.fn();
    render(chips({ onStatusChange }));

    fireEvent.click(screen.getByRole('button', { name: 'Destino 2' }));
    expect(onStatusChange).toHaveBeenCalledWith('en_destino');
  });

  it('clears the filter when the active chip is clicked again', () => {
    const onStatusChange = vi.fn();
    render(chips({ activeStatus: 'excepcion', onStatusChange }));

    expect(screen.getByRole('button', { name: 'Excepción 0' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Excepción 0' }));
    expect(onStatusChange).toHaveBeenCalledWith(undefined);
  });

  it('shows Todos as active when no status filter is applied', () => {
    render(chips());

    expect(screen.getByRole('button', { name: 'Todos 11' })).toHaveAttribute('aria-pressed', 'true');
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
