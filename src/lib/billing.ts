// ============================================================================
// Billing API client — talks to the hit-ever2 Worker (/api/billing/*).
// ============================================================================
// Billing lives in the Worker (not InsForge-direct) so the money logic and its
// auth stay in one place. Calls go through the shared workerApi helper (SDK
// HTTP client + session-refresh retry on 401).

import { workerApi } from './apiClient'

const API_BASE = (import.meta.env.PUBLIC_API_URL as string) || 'https://hit-ever-scraper.nativerse.workers.dev'

export type FreightType = 'AIR' | 'MAR'
// Tiers are dynamic (each agency creates its own via the rate tables); the Worker
// resolves prices per-org and rejects unoffered tiers. This is just a label type.
export type PriceTier = string
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'VOID'
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CREDIT_BALANCE'
export type PaymentBank = 'BAC' | 'LAFISE' | 'BANPRO'
export type Currency = 'USD' | 'NIO'

export interface CatalogEntry {
  freightType: FreightType
  cost: number
  tiers: Record<string, number | null>
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
export interface DateRangeSummary {
  from: string
  to: string
  invoices: number
  revenue: number
  profit: number
  receivables: number
  byFreight: Record<FreightType, { revenue: number; profit: number; lbs: number }>
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

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const billingApi = {
  health: () => workerApi<{ module: string; user: { role: string; name: string | null } }>(`${API_BASE}/api/billing/health`),
  catalog: () => workerApi<CatalogEntry[]>(`${API_BASE}/api/billing/catalog`),
  quote: (freightType: FreightType, tier: PriceTier, lbs: number) =>
    workerApi<Quote>(`${API_BASE}/api/billing/quote${qs({ freightType, tier, lbs })}`),
  listInvoices: (f: InvoiceFilters) => workerApi<{ rows: InvoiceListRow[]; count: number }>(`${API_BASE}/api/billing/invoices${qs({ ...f })}`),
  getInvoice: (id: string) => workerApi<InvoiceView>(`${API_BASE}/api/billing/invoices/${id}`),
  createInvoice: (input: CreateInvoiceInput) => workerApi<InvoiceView>(`${API_BASE}/api/billing/invoices`, { method: 'POST', body: input }),
  applyPayment: (id: string, input: ApplyPaymentInput) =>
    workerApi<InvoiceView>(`${API_BASE}/api/billing/invoices/${id}/payments`, { method: 'POST', body: input }),
  voidInvoice: (id: string, reason?: string) =>
    workerApi<InvoiceView>(`${API_BASE}/api/billing/invoices/${id}/void`, { method: 'POST', body: { reason } }),
  linkPackage: (id: string, ref: { packageId?: string; guia?: string }) =>
    workerApi<InvoiceView>(`${API_BASE}/api/billing/invoices/${id}/packages`, { method: 'POST', body: ref }),
  unlinkPackage: (id: string, packageId: string) =>
    workerApi<InvoiceView>(`${API_BASE}/api/billing/invoices/${id}/packages/${packageId}`, { method: 'DELETE' }),
  closeMonth: (year: number, month: number) => workerApi<MonthlyClose>(`${API_BASE}/api/billing/close-month${qs({ year, month })}`),
  reports: (year: number) => workerApi<YearReport>(`${API_BASE}/api/billing/reports${qs({ year })}`),
  summary: (from: string, to: string) => workerApi<DateRangeSummary>(`${API_BASE}/api/billing/summary${qs({ from, to })}`),
  exceptions: () => workerApi<Exceptions>(`${API_BASE}/api/billing/exceptions`),
  shareInvoice: (id: string) => workerApi<{ token: string; url: string }>(`${API_BASE}/api/billing/invoices/${id}/share`, { method: 'POST' }),
}
