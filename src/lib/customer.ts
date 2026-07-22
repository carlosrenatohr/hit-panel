import { insforge } from './insforge'

const API_BASE = (import.meta.env.PUBLIC_API_URL as string) || 'https://hit-ever-scraper.honchkrow1995.workers.dev'

export interface Customer {
  id: string
  name: string
  nameNormalized: string
  casillero: string | null
  toReview: boolean
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
  const response = await fetch(`${API_BASE}/api/customer${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? `Error ${response.status}`)
  return body.data as T
}

export const customerApi = {
  list: (filters: CustomerFilters) => api<{ rows: Customer[]; count: number }>(`/clients${qs(filters)}`),
  get: (id: string) => api<Customer>(`/clients/${id}`),
  create: (input: CustomerInput) => api<Customer>('/clients', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<CustomerInput>) => api<Customer>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
}
