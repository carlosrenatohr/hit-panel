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
// loops forever.

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
