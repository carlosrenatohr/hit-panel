import { workerApi } from './apiClient'

const API_BASE = (import.meta.env.PUBLIC_API_URL as string) || 'https://hit-ever-scraper.nativerse.workers.dev'

export interface Customer {
  id: string
  name: string
  nameNormalized: string
  casillero: string | null
  toReview: boolean
  email: string | null
  phone: string | null
  address: string | null
  /** Default rate table (preselects pricing on this client's next invoice). */
  defaultRateId: string | null
  /** Default rate card (v2 plan) — takes precedence over defaultRateId. */
  defaultRateCardId: string | null
  /** Company / sub-agency this client belongs to (nullable: personal clients have none). */
  companyName?: string | null
  /** Tax identifier (cédula / RUC) of the client or its company. */
  taxId?: string | null
  /** Lifecycle state — false = deactivated (packages hidden from dashboards until reactivated). */
  active?: boolean
  /** Total packages related to this client (derived from packages.client_id). */
  packageCount?: number
  /** Summed weight (lb) of marítimo packages within the filter range. */
  weightMaritimo?: number
  /** Summed weight (lb) of aéreo packages within the filter range. */
  weightAereo?: number
  /** Count of marítimo packages within the filter range. */
  countMaritimo?: number
  /** Count of aéreo packages within the filter range. */
  countAereo?: number
}

export interface CustomerFilters {
  search?: string
  /** Lifecycle statuses (active|inactive|review), OR'd. Omitted = all clients. */
  statuses?: string[]
  toReview?: boolean
  /** Reception-date range (received_at), same semantics as the Shipments filter. */
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

/** KPI-card aggregates for the whole agency within a date range. */
export interface CustomerAggregateStats {
  totalWeightLb: number
  weightMaritimo: number
  weightAereo: number
  packageCountTotal: number
  packageCountMaritimo: number
  packageCountAereo: number
  topMaritimo: { clientId: string; name: string; weightLb: number } | null
  topAereo: { clientId: string; name: string; weightLb: number } | null
}

/** One event on a client's timeline (from audit_logs). */
export interface CustomerEvent {
  id: string
  organizationId: string
  actorId: string | null
  actorEmail: string | null
  actorType: string
  action: string
  entityType: string
  entityId: string | null
  requestId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface CustomerInput {
  name: string
  casillero?: string | null
  toReview?: boolean
  email?: string | null
  phone?: string | null
  address?: string | null
  companyName?: string | null
  taxId?: string | null
  active?: boolean
  defaultRateTableId?: string | null
  defaultRateCardId?: string | null
}

/** Impact summary for the delete confirmation dialog (samples capped at 5 per kind). */
export interface CustomerDeletePreview {
  client: Customer
  packages: Array<{ guia: string | null; tracking: string | null }>
  packageCount: number
  invoices: Array<{ fiscalYear: number; invoiceNumber: number; status: string }>
  invoiceCount: number
}

function qs(params: object): string {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      // The worker reads the multi-status filter as a comma-separated `status` param.
      if (value.length) p.set(key === 'statuses' ? 'status' : key, value.join(','))
    } else {
      p.set(key, String(value))
    }
  }
  const result = p.toString()
  return result ? `?${result}` : ''
}

export const customerApi = {
  list: (filters: CustomerFilters) => workerApi<{ rows: Customer[]; count: number }>(`${API_BASE}/api/customer/clients${qs(filters)}`),
  get: (id: string) => workerApi<Customer>(`${API_BASE}/api/customer/clients/${id}`),
  create: (input: CustomerInput) => workerApi<Customer>(`${API_BASE}/api/customer/clients`, { method: 'POST', body: input }),
  update: (id: string, input: Partial<CustomerInput>) => workerApi<Customer>(`${API_BASE}/api/customer/clients/${id}`, { method: 'PATCH', body: input }),
  /** KPI aggregates for the client cards (weights + package counts + top clients). */
  stats: (from?: string, to?: string) => workerApi<CustomerAggregateStats>(`${API_BASE}/api/customer/stats${qs({ from, to })}`),
  /** Event timeline for a single client (audit_logs). */
  events: (id: string, page = 1, pageSize = 50) =>
    workerApi<{ rows: CustomerEvent[]; count: number }>(`${API_BASE}/api/customer/clients/${id}/events${qs({ page, pageSize })}`),
  /** Impact summary (packages + invoices) shown before confirming a delete. */
  deletePreview: (id: string) => workerApi<CustomerDeletePreview>(`${API_BASE}/api/customer/clients/${id}/delete-preview`),
  /** Soft delete (never physical) — hides the client from operational reads. */
  delete: (id: string, reason?: string | null) =>
    workerApi<{ id: string; deleted: true }>(`${API_BASE}/api/customer/clients/${id}`, { method: 'DELETE', body: { reason: reason ?? null } }),
}
