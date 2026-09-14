/** Regla general del panel: máximo de tarjetas resumen visibles por módulo. */
export const MAX_VISIBLE_CARDS = 8

/** Acota una lista de tarjetas al máximo permitido por el panel. */
export function capCards<T>(cards: T[]): T[] {
  return cards.slice(0, MAX_VISIBLE_CARDS)
}