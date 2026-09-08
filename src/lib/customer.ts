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
  /** Company / sub-agency this client belongs to (nullable: personal clients have none). */
  companyName?: string | null
  /** Tax identifier (cédula / RUC) of the client or its company. */
  taxId?: string | null
  /** Lifecycle state — false = deactivated (packages hidden from dashboards until reactivated). */
  active?: boolean
  /** Total packages related to this client (derived from packages.client_id). */
  packageCount?: number
}

export interface CustomerFilters {
  search?: string
  /** Lifecycle statuses (active|inactive|review), OR'd. Omitted = all clients. */
  statuses?: string[]
  toReview?: boolean
  page?: number
  pageSize?: number
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
}
