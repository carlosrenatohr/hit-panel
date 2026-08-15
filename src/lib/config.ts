import { insforge } from './insforge'

const API_BASE = (import.meta.env.PUBLIC_API_URL as string) || 'https://hit-ever-scraper.nativerse.workers.dev'

export interface AgencyInfo {
  slug: string
  name: string
  logoUrl: string | null
}

export type FreightType = 'AIR' | 'MAR'

export type PriceTier = 'REGULAR' | 'ESPECIAL' | 'VIP' | 'MADRES' | 'DARIO'

export const TIER_LABELS: Record<PriceTier, string> = {
  REGULAR: 'Regular',
  ESPECIAL: 'Especial',
  VIP: 'VIP',
  MADRES: 'Madres',
  DARIO: 'Dario',
}

export interface RateRow {
  tier: PriceTier
  price: number
  cost: number | null
}

export interface RateTableInfo {
  id: string
  organizationId: string
  name: string
  freightType: FreightType
  createdAt: string
  updatedAt: string
  rows: RateRow[]
}

export interface AuditLogEntry {
  id: string
  organizationId: string
  actorId: string | null
  actorEmail: string | null
  actorType: string
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  requestId: string | null
}

export interface AuditFilter {
  action?: string
  entityType?: string
  entityId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

interface TokenSource {
  getAccessToken?: () => string | null
  getSession?: () => { accessToken?: string | null } | null
}

interface ClientWithToken {
  tokenManager?: TokenSource
  auth?: TokenSource
}

function accessToken(): string | null {
  const client = insforge as unknown as ClientWithToken
  return client.tokenManager?.getAccessToken?.() ?? client.auth?.getAccessToken?.() ?? client.auth?.getSession?.()?.accessToken ?? null
}

function qs(params: object): string {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') p.set(key, String(value))
  }
  const result = p.toString()
  return result ? `?${result}` : ''
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = accessToken()
  if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.')
  const response = await fetch(`${API_BASE}/api/config${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !body?.ok) {
    const raw = body?.error?.message ?? `Error ${response.status}`
    throw new Error(raw.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[redact]'))
  }
  return body.data as T
}

export const configApi = {
  branding: () => api<{ agencies: AgencyInfo[] }>('/branding'),
   updateBranding: (slug: string, patch: { logoKey?: string | null }) =>
     api<{ slug: string; logoUrl: string | null }>(`/branding/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  listRates: (organizationId?: string) =>
    api<{ organizationId: string; tables: RateTableInfo[] }>(
      `/rates${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`,
    ),
  createRate: (input: { name: string; freightType: FreightType; organizationId?: string }) =>
    api<RateTableInfo>('/rates', { method: 'POST', body: JSON.stringify(input) }),
   renameRate: (id: string, name: string) =>
     api<RateTableInfo>(`/rates/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
   deleteRate: (id: string) => api<{ ok: boolean }>(`/rates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
   replaceRows: (id: string, rows: RateRow[]) =>
     api<{ id: string; rows: RateRow[] }>(`/rates/${encodeURIComponent(id)}/rows`, { method: 'PUT', body: JSON.stringify({ rows }) }),
  assignClientDefault: (clientId: string, rateTableId: string | null) =>
    api<{ ok: boolean }>('/rates/assign-client', { method: 'POST', body: JSON.stringify({ clientId, rateTableId }) }),
  overridePackage: (guia: string, rateTableId: string | null) =>
    api<{ ok: boolean }>('/rates/override-package', { method: 'POST', body: JSON.stringify({ guia, rateTableId }) }),
  audit: (filter: AuditFilter = {}) =>
    api<{ organizationId: string; rows: AuditLogEntry[]; count: number }>(`/audit${qs(filter)}`),
}
