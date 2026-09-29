// Lightweight cross-view data invalidation for the panel SPA.
//
// Every mutation (package created, status changed, invoice closed, client
// edited…) bumps the domain(s) it touched with `bumpData()`; any mounted view
// that consumes `useDataVersion(...)` refetches as soon as its data could have
// changed — no prop drilling, no per-view duplicate machinery (this replaces
// Shipments' `refreshToken` prop and App's `listReload` counter).
//
// HARD RULE: call `bumpData()` from mutation handlers only — never from inside
// an effect that also subscribes with `useDataVersion`, or the subscription
// loops forever. (Excepción deliberada: el refetch por focus/visibility de
// `startFocusRefetch` bumpa desde un listener discreto — sus vistas refetchan
// sin volver a bumpar, así que no puede loopear.)

import { useEffect, useState } from 'preact/hooks'

export type DataDomain = 'packages' | 'clients' | 'invoices'

const versions: Record<DataDomain, number> = { packages: 0, clients: 0, invoices: 0 }
const listeners = new Set<() => void>()

/** Marks one or more domains as changed. Views subscribed to them refetch. */
export function bumpData(...domains: DataDomain[]): void {
  for (const d of domains) versions[d] += 1
  for (const l of [...listeners]) l()
}

export function getDataVersion(d: DataDomain): number {
  return versions[d]
}

export function subscribeDataVersion(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Re-renders the caller whenever any of `domains` bumps. Returns a monotonic
 * aggregate; feed it into your fetch effect deps.
 */
export function useDataVersion(...domains: DataDomain[]): number {
  const key = domains.join()
  const [v, setV] = useState(() => domains.reduce((a, d) => a + versions[d], 0))
  useEffect(() => {
    const cb = () => {
      setV(domains.reduce((a, d) => a + versions[d], 0))
    }
    return subscribeDataVersion(cb)
    // The domain list is fixed for the life of the hook — subscribe once per key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return v
}

// ─── Refetch al volver a la pestaña (focus / visibilitychange) ───────────────
// Otra ventana, otro dispositivo o el worker pueden haber cambiado los datos
// mientras el panel estaba en segundo plano. Al volver, un bump de TODOS los
// dominios hace que cada vista suscripta refetchee sola (mismo bus que las
// mutaciones — sin polling ni "Actualizar" manual).
// Throttle ~5s para no flapear en toggles rápidos de foco/visibilidad;
// el primer evento dentro de la ventana tras montar se deduplica porque las
// vistas ya fetchearon al montar. Devuelve una stop() para desuscribirse.
const FOCUS_THROTTLE_MS = 5_000

export function startFocusRefetch(throttleMs = FOCUS_THROTTLE_MS): () => void {
  // Sembrado en `now()`: un focus inmediato tras montar es redundante con el
  // fetch inicial de cada vista; volver después de N segundos sí refetchea.
  let lastBumpAt = Date.now()

  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    const now = Date.now()
    if (now - lastBumpAt < throttleMs) return
    lastBumpAt = now
    bumpData('packages', 'clients', 'invoices')
  }

  window.addEventListener('focus', onVisible)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.removeEventListener('focus', onVisible)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
