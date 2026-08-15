import { createClient } from '@insforge/sdk'
import type { Evt, Note, PackageDetail, Pkg, Provider, ProviderNote, SessionUser, Stats, Tag } from './types'

const baseUrl = import.meta.env.PUBLIC_INSFORGE_URL as string
const anonKey = import.meta.env.PUBLIC_INSFORGE_ANON_KEY as string

export const insforge = createClient({ baseUrl, anonKey })

// Lightweight column set for the list view (skip heavy/internal-only fields).
const LIST_COLS =
  'id,almacen_id,organization_id,tracking_number,status,manual_status,effective_status,service_type,weight_lb,pieces,origin_office,dest_office,referencia_name,photo_ref,received_at,last_event_at,scraped_at,provider_id,providers(code,name,base_url)'

// ── Auth ────────────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await insforge.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await insforge.auth.signOut()
}

/** Step 1 of self-service reset: emails a 6-digit code (InsForge `resetPasswordMethod: "code"`). */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await insforge.auth.sendResetPasswordEmail({ email })
  if (error) throw error
}

/** Step 2: sets the new password using the code from the email. */
export async function completePasswordReset(otp: string, newPassword: string): Promise<void> {
  const { error } = await insforge.auth.resetPassword({ otp, newPassword })
  if (error) throw error
}

/** Resolves the signed-in user + their staff role from app_users (RLS-gated). Null if not staff. */
export async function currentUser(): Promise<SessionUser | null> {
  const { data, error } = await insforge.auth.getCurrentUser()
  if (error || !data?.user) return null
  const { data: row } = await insforge.database
    .from('app_users')
    .select('role,name,email,active,agency')
    .eq('id', data.user.id)
    .maybeSingle()
  if (!row || row.active === false) return null
  return { id: data.user.id, email: row.email ?? data.user.email, role: row.role, name: row.name, agency: row.agency === 'suite' ? 'suite' : 'hit' }
}

// ── Reads ─────────────────────────────────────────────────────────────────────
export async function getStats(organizationId?: string): Promise<Stats> {
  const { data, error } = await insforge.database.rpc('dashboard_stats', organizationId ? { p_org: organizationId } : {})
  if (error) throw error
  return (data as Stats) ?? { total: 0, by_status: {}, by_provider: {}, last_scraped: {}, delivered_30d: 0 }
}

// Providers are tenant-scoped via providers.organization_id: a user only sees
// the providers of their own agency (hit → everest + global_connection, suite → suite_demo).
export async function getProviders(agency?: string): Promise<Provider[]> {
  let q = insforge.database.from('providers').select('id,code,name').order('code')
  if (agency) q = q.eq('organization_id', agency)
  const { data, error } = await q
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
  organizationId?: string  // tenant filter — staff gets pinned; admin/billing can override
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

  if (f.organizationId) q = q.eq('organization_id', f.organizationId)
  if (f.search && f.search.trim()) {
    const s = f.search.trim().replace(/[(),*]/g, '')
    q = q.or(`almacen_id.ilike.*${s}*,tracking_number.ilike.*${s}*,casillero.ilike.*${s}*,referencia_name.ilike.*${s}*`)
  }
  if (f.providerId) q = q.eq('provider_id', f.providerId)
  if (f.status) q = q.eq('effective_status', f.status)
  if (f.service) q = q.eq('service_type', f.service)
  if (f.from) q = q.gte('received_at', f.from)
  // `to` is a date-only string; received_at is timestamptz. `lte('2026-07-10')` compares against
  // midnight and drops everything received later that day. Use `< next day` to include the whole day.
  if (f.to) {
    const next = new Date(f.to + 'T00:00:00Z')
    next.setUTCDate(next.getUTCDate() + 1)
    q = q.lt('received_at', next.toISOString().slice(0, 10))
  }

  const sortCol = f.sortCol ?? 'status_rank'
  q = q.order(sortCol, { ascending: f.ascending ?? false })
  // Default "ready for pickup first" view: within a status rank, surface the packages that have
  // waited longest since Miami reception (oldest first) — the most overdue for their next step.
  if (sortCol === 'status_rank') q = q.order('received_at', { ascending: true })
  q = q.range(fromIdx, toIdx)

  const { data, count, error } = await q
  if (error) throw error
  // The SDK infers the to-one `providers(...)` embed as an array and LIST_COLS omits heavy Pkg
  // fields, so the shapes don't overlap for a direct cast — go through `unknown` (compiler's advice).
  return { rows: (data as unknown as Pkg[]) ?? [], count: count ?? 0 }
}

export async function getPackageDetail(guia: string, organizationId?: string): Promise<PackageDetail | null> {
  let q = insforge.database
    .from('packages')
    .select('*, providers(code,name,base_url)')
    .eq('almacen_id', guia)
    // A guide can exist in both provider ledgers. Match the Worker lookup and use the newest row.
    .order('scraped_at', { ascending: false })
    .limit(1)
  if (organizationId) q = q.eq('organization_id', organizationId)
  const { data: pkg, error } = await q.maybeSingle()
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
export async function createPackage(input: {
  almacenId: string
  trackingNumber?: string | null
  serviceType?: 'aereo' | 'maritimo' | null
  referenciaName?: string | null
  casillero?: string | null
  weightLb?: number | null
  pieces?: number | null
  volumeCf?: number | null
  dimensions?: string | null
  originOffice?: string | null
  destOffice?: string | null
  description?: string | null
  remitente?: string | null
  declaredValue?: number | null
  photoRef?: string | null
  receivedAt?: string | null
}): Promise<{ id: string; almacenId: string; organizationId: string }> {
  const { error, data } = await insforge.database.rpc('create_package', {
    p_almacen_id: input.almacenId,
    p_tracking_number: input.trackingNumber ?? null,
    p_service_type: input.serviceType ?? null,
    p_referencia_name: input.referenciaName ?? null,
    p_casillero: input.casillero ?? null,
    p_weight_lb: input.weightLb ?? null,
    p_pieces: input.pieces ?? null,
    p_volume_cf: input.volumeCf ?? null,
    p_dimensions: input.dimensions ?? null,
    p_origin_office: input.originOffice ?? null,
    p_dest_office: input.destOffice ?? null,
    p_description: input.description ?? null,
    p_remitente: input.remitente ?? null,
    p_declared_value: input.declaredValue ?? null,
    p_photo_ref: input.photoRef ?? null,
    p_received_at: input.receivedAt ?? null,
  })
  if (error) throw error
  const d = data as { id: string; almacen_id: string; organization_id: string } | null
  if (!d) throw new Error('No se pudo crear el paquete.')
  return { id: d.id, almacenId: d.almacen_id, organizationId: d.organization_id }
}

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
