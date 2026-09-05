import { getAccessToken, workerApi } from './apiClient'

const API_BASE = (import.meta.env.PUBLIC_API_URL as string) || 'https://hit-ever-scraper.nativerse.workers.dev'

export interface AgencyInfo {
  slug: string
  name: string
  logoUrl: string | null
}

/** Agency profile (Config > Información) — drives invoice PDF header and money symbols. */
export interface AgencyProfile {
  slug: string
  name: string
  ruc: string | null
  address: string | null
  phone: string | null
  currency: CurrencyCode
  isScrapable: boolean
}

export type CurrencyCode = 'USD' | 'NIO'

export interface AgencyInfoPatch {
  ruc?: string | null
  address?: string | null
  phone?: string | null
  currency?: CurrencyCode
}

export interface PaymentCatalogItem {
  id: string
  name: string
  active: boolean
}

export interface PaymentCatalogs {
  methods: PaymentCatalogItem[]
  banks: PaymentCatalogItem[]
}

export type FreightType = 'AIR' | 'MAR'

export type PriceTier = string

export const TIER_LABELS: Record<string, string> = {
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

function qs(params: object): string {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') p.set(key, String(value))
  }
  const result = p.toString()
  return result ? `?${result}` : ''
}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  try {
    return await workerApi<T>(`${API_BASE}/api/config${path}`, init)
  } catch (e) {
    // Same message, minus any UUIDs the server may have echoed (they are not
    // useful to the user and leak internal identifiers into the UI).
    const raw = e instanceof Error ? e.message : 'Error inesperado.'
    throw new Error(raw.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[redact]'))
  }
}

export const configApi = {
  branding: () => api<{ agencies: AgencyInfo[] }>('/branding'),
   updateBranding: (slug: string, patch: { logoKey?: string | null }) =>
     api<{ slug: string; logoUrl: string | null }>(`/branding/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: patch,
    }),
  info: () => api<AgencyProfile>('/info'),
  updateInfo: (patch: AgencyInfoPatch) => api<AgencyProfile>('/info', { method: 'PATCH', body: patch }),
  paymentCatalogs: () => api<PaymentCatalogs>('/payments'),
  createPaymentMethod: (name: string) => api<PaymentCatalogItem>('/payments/methods', { method: 'POST', body: { name } }),
  updatePaymentMethod: (id: string, patch: { name?: string; active?: boolean }) =>
    api<{ ok: boolean }>(`/payments/methods/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  createPaymentBank: (name: string) => api<PaymentCatalogItem>('/payments/banks', { method: 'POST', body: { name } }),
  updatePaymentBank: (id: string, patch: { name?: string; active?: boolean }) =>
    api<{ ok: boolean }>(`/payments/banks/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  listRates: (organizationId?: string) =>
    api<{ organizationId: string; tables: RateTableInfo[] }>(
      `/rates${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`,
    ),
  createRate: (input: { name: string; freightType: FreightType; organizationId?: string }) =>
    api<RateTableInfo>('/rates', { method: 'POST', body: input }),
   renameRate: (id: string, name: string) =>
     api<RateTableInfo>(`/rates/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } }),
   deleteRate: (id: string) => api<{ ok: boolean }>(`/rates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
   replaceRows: (id: string, rows: RateRow[]) =>
     api<{ id: string; rows: RateRow[] }>(`/rates/${encodeURIComponent(id)}/rows`, { method: 'PUT', body: { rows } }),
  assignClientDefault: (clientId: string, rateTableId: string | null) =>
    api<{ ok: boolean }>('/rates/assign-client', { method: 'POST', body: { clientId, rateTableId } }),
  overridePackage: (guia: string, rateTableId: string | null) =>
    api<{ ok: boolean }>('/rates/override-package', { method: 'POST', body: { guia, rateTableId } }),
  audit: (filter: AuditFilter = {}) =>
    api<{ organizationId: string; rows: AuditLogEntry[]; count: number }>(`/audit${qs(filter)}`),
  /**
   * Proxy a provider photo through the worker (staff-gated) and return a blob
   * object URL. The panel CSP blocks *.cargotrack.net images, so photos are
   * fetched with the bearer token and displayed as blob: URLs (already allowed
   * by img-src). Returns null if the photo can't be fetched.
   */
  proxyPhotoUrl: async (rawUrl: string | null): Promise<string | null> => {
    if (!rawUrl) return null
    const token = getAccessToken()
    if (!token) return null
    try {
      const res = await fetch(`${API_BASE}/api/photo?url=${encodeURIComponent(rawUrl)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    } catch {
      return null
    }
  },
}
