import { createClient } from '@insforge/sdk'
import type { Evt, Note, PackageDetail, Pkg, Provider, ProviderNote, SessionUser, Stats, Tag } from './types'

const baseUrl = import.meta.env.PUBLIC_INSFORGE_URL as string
const anonKey = import.meta.env.PUBLIC_INSFORGE_ANON_KEY as string

export const insforge = createClient({ baseUrl, anonKey })

// Lightweight column set for the list view (skip heavy/internal-only fields).
const LIST_COLS =
  'id,almacen_id,tracking_number,status,manual_status,effective_status,service_type,weight_lb,pieces,origin_office,dest_office,referencia_name,photo_ref,received_at,last_event_at,scraped_at,provider_id,providers(code,name,base_url)'

// ── Auth ────────────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await insforge.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await insforge.auth.signOut()
}

/** Resolves the signed-in user + their staff role from app_users (RLS-gated). Null if not staff. */
export async function currentUser(): Promise<SessionUser | null> {
  const { data, error } = await insforge.auth.getCurrentUser()
  if (error || !data?.user) return null
  const { data: row } = await insforge.database
    .from('app_users')
    .select('role,name,email,active')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!row || row.active === false) return null
  return { id: data.user.id, email: row.email ?? data.user.email, role: row.role, name: row.name }
}

// ── Reads ─────────────────────────────────────────────────────────────────────
export async function getStats(): Promise<Stats> {
  const { data, error } = await insforge.database.rpc('dashboard_stats')
  if (error) throw error
  return (data as Stats) ?? { total: 0, by_status: {}, by_provider: {}, last_scraped: {}, delivered_30d: 0 }
}

export async function getProviders(): Promise<Provider[]> {
  const { data, error } = await insforge.database.from('providers').select('id,code,name').order('code')
  if (error) throw error
  return (data as Provider[]) ?? []
}

export interface ListFilters {
  search?: string
  providerId?: string
  status?: string
  service?: string
  from?: string
  to?: string
  sortCol?: string
  ascending?: boolean
  page?: number
  pageSize?: number
}

export interface ListResult {
  rows: Pkg[]
  count: number
}

export async function listPackages(f: ListFilters): Promise<ListResult> {
  const page = f.page ?? 1
  const pageSize = f.pageSize ?? 25
  const fromIdx = (page - 1) * pageSize
  const toIdx = fromIdx + pageSize - 1

  let q = insforge.database.from('packages').select(LIST_COLS, { count: 'exact' })

  if (f.search && f.search.trim()) {
    const s = f.search.trim().replace(/[(),*]/g, '')
    q = q.or(`almacen_id.ilike.*${s}*,tracking_number.ilike.*${s}*,casillero.ilike.*${s}*`)
  }
  if (f.providerId) q = q.eq('provider_id', f.providerId)
  if (f.status) q = q.eq('effective_status', f.status)
  if (f.service) q = q.eq('service_type', f.service)
  if (f.from) q = q.gte('received_at', f.from)
  if (f.to) q = q.lte('received_at', f.to)

  q = q.order(f.sortCol ?? 'received_at', { ascending: f.ascending ?? false })
  q = q.range(fromIdx, toIdx)

  const { data, count, error } = await q
  if (error) throw error
  return { rows: (data as Pkg[]) ?? [], count: count ?? 0 }
}

export async function getPackageDetail(guia: string): Promise<PackageDetail | null> {
  const { data: pkg, error } = await insforge.database
    .from('packages')
    .select('*, providers(code,name,base_url)')
    .eq('almacen_id', guia)
    .maybeSingle()
  if (error) throw error
  if (!pkg) return null

  const [evRes, pnRes, tagRes, noteRes] = await Promise.all([
    insforge.database.from('events').select('*').eq('package_id', pkg.id).order('occurred_at', { ascending: true }),
    insforge.database.from('package_provider_notes').select('*').eq('package_id', pkg.id),
    insforge.database.from('package_tags').select('*').eq('package_id', pkg.id).order('created_at', { ascending: false }),
    insforge.database.from('package_notes').select('*').eq('package_id', pkg.id).order('created_at', { ascending: false }),
  ])

  return {
    pkg: pkg as Pkg,
    events: (evRes.data as Evt[]) ?? [],
    providerNotes: (pnRes.data as ProviderNote[]) ?? [],
    tags: (tagRes.data as Tag[]) ?? [],
    notes: (noteRes.data as Note[]) ?? [],
  }
}

// ── Writes (staff-only RPCs) ────────────────────────────────────────────────────
export async function setManualStatus(guia: string, status: string, note?: string): Promise<void> {
  const { error } = await insforge.database.rpc('set_manual_status', {
    p_guia: guia, p_status: status, p_note: note ?? null,
  })
  if (error) throw error
}

export async function addTag(guia: string, label: string, value?: string): Promise<void> {
  const { error } = await insforge.database.rpc('add_package_tag', {
    p_guia: guia, p_label: label, p_value: value ?? null,
  })
  if (error) throw error
}

export async function addNote(guia: string, body: string): Promise<void> {
  const { error } = await insforge.database.rpc('add_package_note', { p_guia: guia, p_body: body })
  if (error) throw error
}

/** Fetches up to `cap` rows matching the current filters for CSV export (no pagination). */
export async function exportPackages(f: ListFilters, cap = 1000): Promise<Pkg[]> {
  const { rows } = await listPackages({ ...f, page: 1, pageSize: cap })
  return rows
}
