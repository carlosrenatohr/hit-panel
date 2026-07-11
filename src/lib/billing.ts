// ============================================================================
// Billing API client — talks to the hit-ever2 Worker (/api/billing/*).
// ============================================================================
// Billing lives in the Worker (not InsForge-direct) so the money logic and its
// auth stay in one place. We send the signed-in user's InsForge access token as a
// bearer; the Worker verifies it and checks the caller's role/permission.

import { insforge } from './insforge'

const API_BASE = (import.meta.env.PUBLIC_API_URL as string) || 'https://hit-ever-scraper.honchkrow1995.workers.dev'

export type FreightType = 'AIR' | 'MAR'
export type PriceTier = 'REGULAR' | 'ESPECIAL' | 'VIP' | 'MADRES' | 'DARIO'
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOID'
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CREDIT_BALANCE'
export type PaymentBank = 'BAC' | 'LAFISE' | 'BANPRO'
export type Currency = 'USD' | 'NIO'

export interface CatalogEntry {
  freightType: FreightType
  cost: number
  tiers: Record<PriceTier, number | null>
}
export interface Quote {
  freightType: FreightType
  tier: PriceTier
  quantityLbs: number
  unitPrice: number
  total: number
  freightCost: number
  profit: number
  margin: number | null
}
export interface InvoiceListRow {
  id: string
  invoiceNumber: number
  fiscalYear: number
  clientName: string | null
  issueDate: string | null
  paidAt: string | null
  status: InvoiceStatus
  total: number
  profit: number
  paidUsd: number
  outstanding: number
}
export interface InvoiceView extends InvoiceListRow {
  clientId: string | null
  address: string | null
  specialPrice: boolean
  observations: string | null
  trackingOrders: string[]
  margin: number | null
  lines: Array<{
    lineNo: number
    description: string | null
    freightType: FreightType
    quantityLbs: number
    unitPrice: number
    total: number
    freightCost: number
    profit: number
    priceTier: PriceTier | null
    priceOffCatalog: boolean
  }>
  payments: Array<{
    method: string | null
    bank: string | null
    currency: string | null
    amount: number | null
    amountUsd: number | null
    fxRate: number | null
    paidAt: string | null
    raw: string | null
    quarantined: boolean
  }>
  packages: Array<{ packageId: string; source: 'auto' | 'manual'; matchedOc: string | null }>
}
export interface MonthlyClose {
  year: number
  month: number
  invoices: number
  revenue: number
  profit: number
  receivables: number
  byFreight: Record<FreightType, { revenue: number; profit: number; lbs: number }>
}
export interface YearReport {
  year: number
  invoices: number
  revenue: number
  profit: number
  receivables: number
  byMonth: Array<{ month: number; revenue: number; profit: number; invoices: number }>
  byFreight: Record<FreightType, { revenue: number; profit: number; lbs: number }>
}
export interface ExceptionRow {
  invoiceId: string
  invoiceNumber: number
  fiscalYear: number
  client: string | null
  detail: string
}
export interface Exceptions {
  offCatalog: ExceptionRow[]
  quarantinedPayments: ExceptionRow[]
  orphanInvoices: ExceptionRow[]
  clientsToReview: { id: string; name: string }[]
}

export interface InvoiceFilters {
  status?: InvoiceStatus
  freightType?: FreightType
  fiscalYear?: number
  search?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}
export interface CreateInvoiceInput {
  clientName: string
  issueDate?: string
  address?: string | null
  specialPrice?: boolean
  observations?: string | null
  lines: Array<{ freightType: FreightType; tier: PriceTier; quantityLbs: number; description?: string | null }>
  packageIds?: string[]
}
export interface ApplyPaymentInput {
  method: PaymentMethod
  bank?: PaymentBank | null
  currency: Currency
  amount: number
  fxRate?: number | null
  paidAt?: string
}

interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

// The SDK keeps the live access token in the client's (private) TokenManager —
// `insforge.tokenManager.getAccessToken()`. `.auth` does NOT expose it publicly, so
// read it through a minimal interface (private at the type level, present at runtime).
// TokenManager is the shared instance the SDK updates on refresh, so this stays live.
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

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = accessToken()
  if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.')
  const res = await fetch(`${API_BASE}/api/billing${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error?.message ?? `Error ${res.status}`)
  }
  return body.data as T
}

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const billingApi = {
  health: () => api<{ module: string; user: { role: string; name: string | null } }>('/health'),
  catalog: () => api<CatalogEntry[]>('/catalog'),
  quote: (freightType: FreightType, tier: PriceTier, lbs: number) =>
    api<Quote>(`/quote${qs({ freightType, tier, lbs })}`),
  listInvoices: (f: InvoiceFilters) => api<{ rows: InvoiceListRow[]; count: number }>(`/invoices${qs({ ...f })}`),
  getInvoice: (id: string) => api<InvoiceView>(`/invoices/${id}`),
  createInvoice: (input: CreateInvoiceInput) => api<InvoiceView>('/invoices', { method: 'POST', body: JSON.stringify(input) }),
  applyPayment: (id: string, input: ApplyPaymentInput) =>
    api<InvoiceView>(`/invoices/${id}/payments`, { method: 'POST', body: JSON.stringify(input) }),
  voidInvoice: (id: string, reason?: string) =>
    api<InvoiceView>(`/invoices/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
  linkPackage: (id: string, ref: { packageId?: string; guia?: string }) =>
    api<InvoiceView>(`/invoices/${id}/packages`, { method: 'POST', body: JSON.stringify(ref) }),
  unlinkPackage: (id: string, packageId: string) =>
    api<InvoiceView>(`/invoices/${id}/packages/${packageId}`, { method: 'DELETE' }),
  closeMonth: (year: number, month: number) => api<MonthlyClose>(`/close-month${qs({ year, month })}`),
  reports: (year: number) => api<YearReport>(`/reports${qs({ year })}`),
  exceptions: () => api<Exceptions>('/exceptions'),
  shareInvoice: (id: string) => api<{ token: string; url: string }>(`/invoices/${id}/share`, { method: 'POST' }),
}
