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
}

export interface CustomerFilters {
  search?: string
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
  defaultRateTableId?: string | null
}

function qs(params: object): string {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') p.set(key, String(value))
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
