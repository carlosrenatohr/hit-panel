import { insforge } from './insforge'

const WORKER_URL =
  (import.meta.env.PUBLIC_API_URL as string | undefined)?.replace(/\/+$/, '') ??
  'https://hit-ever-scraper.honchkrow1995.workers.dev'

// Mirrors the server's per-guia cooldown (hit-ever2/src/routes/staff.ts, 5 min) so the
// button disables immediately without a round-trip. The server is the source of truth;
// this only avoids hammering it from the UI.
const COOLDOWN_SEC = 5 * 60
const COOLDOWN_KEY = (guia: string) => `hit:refresh-cd:${guia}`

// The SDK keeps the live access token in the client's (private) TokenManager —
// `insforge.tokenManager.getAccessToken()`. `.auth` does NOT expose it publicly, so
// read it through a minimal interface (private at the type level, present at runtime).
// Same pattern as src/lib/billing.ts.
interface TokenSource {
  getAccessToken?: () => string | null
  getSession?: () => { accessToken?: string | null } | null
}
interface ClientWithToken {
  tokenManager?: TokenSource
  auth?: TokenSource
}
function accessToken(): string | null {
  const c = insforge as unknown as ClientWithToken
  return (
    c.tokenManager?.getAccessToken?.() ??
    c.auth?.getAccessToken?.() ??
    c.auth?.getSession?.()?.accessToken ??
    null
  )
}

export interface RefreshOutcome {
  ok: boolean
  provider?: string
  message?: string
}

/**
 * POST /staff/packages/:guia/refresh on the Worker, authenticated with the panel
 * user's own InsForge access token (never the Worker ADMIN_SECRET). Admin-only:
 * the Worker gates on the caller's role before touching Cargotrack.
 */
export async function refreshPackage(guia: string): Promise<RefreshOutcome> {
  const token = accessToken()
  if (!token) {
    return { ok: false, message: 'Sesión expirada. Vuelve a iniciar sesión.' }
  }

  let res: Response
  try {
    res = await fetch(`${WORKER_URL}/staff/packages/${encodeURIComponent(guia)}/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { ok: false, message: 'No se pudo contactar el servicio de re-scrape.' }
  }

  let body: {
    ok?: boolean
    data?: { provider?: string }
    error?: { message?: string; details?: { retryAfterSeconds?: number } }
  } = {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    body = {}
  }

  if (res.status === 429) {
    setRefreshCooldown(guia, body.error?.details?.retryAfterSeconds ?? COOLDOWN_SEC)
    return { ok: false, message: body.error?.message ?? 'Refrescaste hace poco. Espera unos minutos.' }
  }
  if (!res.ok || !body?.ok) {
    return { ok: false, message: body.error?.message ?? `Error ${res.status}` }
  }
  // The server consumes the cooldown slot even on success (first call of the window).
  setRefreshCooldown(guia, COOLDOWN_SEC)
  return { ok: true, provider: body.data?.provider }
}

export function refreshCooldownUntil(guia: string): number {
  const raw = localStorage.getItem(COOLDOWN_KEY(guia))
  if (!raw) return 0
  const until = Number(raw)
  return Number.isFinite(until) && until > Date.now() ? until : 0
}

export function setRefreshCooldown(guia: string, seconds: number): void {
  localStorage.setItem(COOLDOWN_KEY(guia), String(Date.now() + seconds * 1000))
}

export function clearRefreshCooldown(guia: string): void {
  localStorage.removeItem(COOLDOWN_KEY(guia))
}
