// Lightweight cross-view data invalidation for the panel SPA.
//
// Every mutation (package created, status changed, invoice closed, client
// edited…) bumps the domain(s) it touched with `bumpData()`; any mounted view
// that consumes `useDataVersion(...)` refetches as soon as its data could have
// changed — no prop drilling, no per-view duplicate machinery (this replaces
// Shipments' `refreshToken` prop and App's `listReload` counter).
//
// TWO TIERS, because "alguien cambió algo" and "vuelve a mirar por si acambio"
// are not the same event:
//
//   bumpData(...)     mutation → refrescan AMBOS niveles: cuerpo de la vista y
//                     contadores (las tarjetas de ciclo de vida de Paquetería
//                     son 8 requests, uno por estado — no queremos pagarlos en
//                     cada alt-tab).
//   bumpList(...)     focus/visibility → refresca solo el cuerpo; los
//                     contadores quedan quietos hasta la próxima mutación o
//                     recarga explícita ("Actualizar").
//
//   useDataVersion(...)     nivel cuerpo (reacciona a bumpData Y bumpList)
//   useCounterVersion(...)  nivel contadores (solo bumpData)
//
// HARD RULE: call `bumpData()`/`bumpList()` from mutation handlers (or from a
// discrete listener like `startFocusRefetch`) — never from inside an effect
// that also subscribes with the hooks above, or the subscription loops forever.

import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

export type DataDomain = 'packages' | 'clients' | 'invoices'

// Nivel "cuerpo" de la vista: tablas, listas, KPIs que alimentan el contenido.
const versions: Record<DataDomain, number> = { packages: 0, clients: 0, invoices: 0 }
// Nivel "contadores": conteos por estado, tarjetas, agregados caros.
const counterVersions: Record<DataDomain, number> = { packages: 0, clients: 0, invoices: 0 }
const listeners = new Set<() => void>()

function notify(): void {
  for (const l of [...listeners]) l()
}

/** Marks one or more domains as changed by a mutation. Both tiers refetch. */
export function bumpData(...domains: DataDomain[]): void {
  for (const d of domains) {
    versions[d] += 1
    counterVersions[d] += 1
  }
  notify()
}

/**
 * Soft invalidation ("vuelvete a mirar por si cambió") — used by the focus /
 * visibility refetch. Moves only the body tier, so switching tabs never fires
 * the per-status card counts.
 */
export function bumpList(...domains: DataDomain[]): void {
  for (const d of domains) versions[d] += 1
  notify()
}

export function getDataVersion(d: DataDomain): number {
  return versions[d]
}

export function getCounterVersion(d: DataDomain): number {
  return counterVersions[d]
}

export function subscribeDataVersion(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function sum(source: Record<DataDomain, number>, domains: DataDomain[]): number {
  return domains.reduce((a, d) => a + source[d], 0)
}

function useTier(source: Record<DataDomain, number>, domains: DataDomain[]): number {
  const key = domains.join()
  const [v, setV] = useState(() => sum(source, domains))
  useEffect(() => {
    const cb = () => {
      const next = sum(source, domains)
      // Same aggregate → no re-render, no effect re-run (bumpList must not
      // wake counter subscribers).
      setV((prev) => (prev === next ? prev : next))
    }
    return subscribeDataVersion(cb)
    // The domain list is fixed for the life of the hook — subscribe once per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return v
}

/**
 * Body tier — re-renders whenever any of `domains` bumps (mutation or focus).
 * Returns a monotonic aggregate; feed it into your fetch effect deps.
 */
export function useDataVersion(...domains: DataDomain[]): number {
  return useTier(versions, domains)
}

/** Counter tier — bumps only on `bumpData` (mutations / manual refresh). */
export function useCounterVersion(...domains: DataDomain[]): number {
  return useTier(counterVersions, domains)
}

// ─── Frescura ─────────────────────────────────────────────────────────────────
// Cada fetch completado (`useFetchGate().done()`) la refresca. El focus refetch
// la usa para no pedir nada si la vista se acaba de actualizar: volver a la
// pestaña a los 2 segundos no dispara un refetch, volver a los 5 minutos sí.
const FOCUS_STALE_MS = 60_000
let lastFreshAt = Date.now()

export function markDataFresh(at: number = Date.now()): void {
  lastFreshAt = at
}

export function getDataFreshnessAge(now: number = Date.now()): number {
  return now - lastFreshAt
}

// ─── Refetch silencioso (stale-while-revalidate) ──────────────────────────────
// Un bump del bus re-ejecuta el efecto con la MISMA query key: no hay nada que
// cambiar en pantalla, solo traer la versión fresca. Pintar el spinner ahí es
// lo que produce el parpadeo al volver a la pestaña (la tabla entera se
// reemplaza por el spinner y vuelve a aparecer).
//
// `useFetchGate(key)` separa ambos casos:
//   * cambió la key (filtros, página, org) o es la primera carga → `loading`
//     true, la vista pinta su spinner como siempre;
//   * re-ejecución por bump con la misma key (focus o mutación) → la vista
//     conserva lo que tiene en pantalla y el swap es silencioso.
// El `rev` de "Actualizar" va DENTRO de la key: una recarga pedida a mano sí
// da feedback, un refetch del navegador no.
export function useFetchGate(key: string): {
  /** true mientras hay que pintar el spinner (key nueva o recarga explícita). */
  loading: boolean
  /** Call first inside the fetch effect. Returns true when the key changed. */
  begin: () => boolean
  /** Call when the request settles: hides the spinner and marks data fresh. */
  done: () => void
} {
  const [loading, setLoading] = useState(true)
  const lastKey = useRef<string | null>(null)
  const begin = useCallback(() => {
    const changed = lastKey.current !== key
    lastKey.current = key
    if (changed) setLoading(true)
    return changed
  }, [key])
  const done = useCallback(() => {
    setLoading(false)
    markDataFresh()
  }, [])
  return { loading, begin, done }
}

// ─── Refetch al volver a la pestaña (focus / visibilitychange) ───────────────
// Otra ventana, otro dispositivo o el worker pueden haber cambiado los datos
// mientras el panel estaba en segundo plano. Al volver, un bump de la capa
// cuerpo hace que cada vista suscripta refetchee sola (mismo bus que las
// mutaciones — sin polling ni "Actualizar" manual), silencioso y sin tocar los
// contadores. Dos guardas: throttle ~5s para no flapear en toggles rápidos y
// ventana de staleness para no pedir nada si los datos se acaban de cargar.
// Devuelve una stop() para desuscribirse.
const FOCUS_THROTTLE_MS = 5_000

export function startFocusRefetch(
  throttleMs = FOCUS_THROTTLE_MS,
  staleMs = FOCUS_STALE_MS,
): () => void {
  // Sembrado en `now()`: un focus inmediato tras montar es redundante con el
  // fetch inicial de cada vista; volver después de N segundos sí refetchea.
  let lastBumpAt = Date.now()

  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    const now = Date.now()
    if (now - lastBumpAt < throttleMs) return
    // Datos recientes (alguien fetchió hace menos de `staleMs`): nada que pedir.
    if (staleMs > 0 && now - lastFreshAt < staleMs) return
    lastBumpAt = now
    bumpList('packages', 'clients', 'invoices')
  }

  window.addEventListener('focus', onVisible)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.removeEventListener('focus', onVisible)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
