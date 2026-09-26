import type { ShipmentStatus } from './types'

// Internal (staff-facing) Spanish labels — more precise than the public tracker's customer copy.
export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  en_almacen: 'En bodega Miami',
  parcial: 'Parcial',
  en_transito: 'En tránsito',
  en_destino: 'En destino (Nicaragua)',
  entregado: 'Entregado',
  excepcion: 'Excepción',
  desconocido: 'Desconocido',
}

// Short labels for the compact mobile status chips — same canonical keys as
// STATUS_LABEL, so a new status can never drift between the two presentations.
export const STATUS_SHORT: Record<ShipmentStatus, string> = {
  en_almacen: 'Bodega',
  parcial: 'Parcial',
  en_transito: 'Tránsito',
  en_destino: 'Destino',
  entregado: 'Entregado',
  excepcion: 'Excepción',
  desconocido: 'Desconocido',
}

// Solid dot — compact indicator for dense table rows.
export const STATUS_DOT: Record<ShipmentStatus, string> = {
  en_almacen: 'bg-green-500',
  parcial: 'bg-yellow-500',
  en_transito: 'bg-red-500',
  en_destino: 'bg-purple-500',
  entregado: 'bg-orange-500',
  excepcion: 'bg-gray-500',
  desconocido: 'bg-gray-300',
}

// Soft background+text — for the prominent badge (detail header, pipeline legend).
export const STATUS_SOFT: Record<ShipmentStatus, string> = {
  en_almacen: 'bg-green-50 text-green-700',
  parcial: 'bg-yellow-50 text-yellow-800',
  en_transito: 'bg-red-50 text-red-700',
  en_destino: 'bg-purple-50 text-purple-700',
  entregado: 'bg-orange-50 text-orange-700',
  excepcion: 'bg-gray-100 text-gray-700',
  desconocido: 'bg-gray-50 text-gray-500',
}

// Same palette as STATUS_DOT but as literal hex — Chart.js draws to <canvas>, it can't read
// Tailwind utility classes, so chart series need real color values.
export const STATUS_HEX: Record<ShipmentStatus, string> = {
  en_almacen: '#22c55e',
  parcial: '#eab308',
  en_transito: '#ef4444',
  en_destino: '#a855f7',
  entregado: '#f97316',
  excepcion: '#6b7280',
  desconocido: '#d1d5db',
}

// Brand tokens as hex, for chart series (mirrors tailwind.config.js colors.*).
export const BRAND_HEX = {
  primary: '#FF7A00',
  primaryDark: '#E56E00',
  secondary: '#111111',
  navy: '#14213D',
  accentYellow: '#FFD700',
  accentBlue: '#00A8E8',
}
export const PROVIDER_HEX: Record<string, string> = {
  everest: BRAND_HEX.primary,
  global_connection: BRAND_HEX.navy,
}

export const STATUS_ORDER: ShipmentStatus[] = [
  'en_almacen',
  'parcial',
  'en_transito',
  'en_destino',
  'entregado',
  'excepcion',
  'desconocido',
]

// Same 4-stage pipeline as the public tracker (hit-ever2/src/types/tracking.ts STATUS_STEP) —
// staff sees the identical progress logic customers do.
export const PIPELINE_STEP: Record<ShipmentStatus, number> = {
  en_almacen: 1,
  parcial: 2,
  en_transito: 2,
  en_destino: 3,
  entregado: 4,
  excepcion: 0,
  desconocido: 0,
}
export const PIPELINE_STAGES = ['Bodega Miami', 'En tránsito', 'Nicaragua', 'Entregado']

export const SERVICE_LABEL: Record<string, string> = { aereo: 'Aéreo', maritimo: 'Marítimo' }
export const SERVICE_EMOJI: Record<string, string> = { aereo: '✈️', maritimo: '🚢' }
export const PROVIDER_LABEL: Record<string, string> = {
  everest: 'Everest',
  global_connection: 'Global Connection',
}

// Origin office → country flag. Everything we've seen so far is MIA (Miami), but this stays a
// lookup so a new origin office just needs one more entry, not a code change.
const OFFICE_FLAG: Record<string, string> = { MIA: '🇺🇸', MGA: '🇳🇮' }
export function officeFlag(code?: string | null): string {
  return code ? (OFFICE_FLAG[code] ?? '') : ''
}

// Everest has no dedicated hazmat field — the warehouse staff prefixes the Reference field with
// "HAZMAT" instead (e.g. "HAZMAT/FERNANDA QUINTANILLA"). Global Connection never does this.
const HAZMAT_PREFIX = /^hazmat\s*\/?\s*/i
export function isHazmat(referenciaName?: string | null): boolean {
  return !!referenciaName && HAZMAT_PREFIX.test(referenciaName.trim())
}
export function cleanName(referenciaName?: string | null): string {
  if (!referenciaName) return '—'
  return referenciaName.trim().replace(HAZMAT_PREFIX, '').trim() || '—'
}

// Accent folding shared by the client-side filters and the ILIKE expansion below.
/** Lowercase + strip diacritics — accent-insensitive matching for in-memory filters. */
export function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function statusLabel(s?: string | null): string {
  return s ? (STATUS_LABEL[s as ShipmentStatus] ?? s) : '—'
}
export function providerLabel(code?: string | null): string {
  return code ? (PROVIDER_LABEL[code] ?? code) : '—'
}

/**
 * Parse a stored date into a Date, treating a bare YYYY-MM-DD as the LOCAL
 * calendar day (midnight in the user's timezone) instead of UTC midnight.
 * Date-only values come from HTML date inputs and Postgres `date` columns
 * (e.g. invoice issue_date); parsing them as UTC shifts the day back in UTC−
 * zones like Nicaragua. Full ISO timestamps pass through unchanged.
 */
export function toLocalDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
}

export function fmtDateTime(s?: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(+d)) return '—'
  return d.toLocaleString('es-NI', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function fmtDate(s?: string | null): string {
  if (!s) return '—'
  const d = toLocalDate(s)
  if (isNaN(+d)) return '—'
  return d.toLocaleDateString('es-NI', { year: 'numeric', month: 'short', day: '2-digit' })
}

/**
 * HTML date inputs yield 'YYYY-MM-DD' — the user's local calendar day. Send it as
 * local midnight so the stored timestamptz renders back the SAME day (a bare date
 * is parsed as UTC midnight, which falls a day behind in UTC− zones like Nicaragua).
 */
export function dateInputToTimestamptz(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(+d) ? value : d.toISOString()
}

export function daysAgo(s?: string | null): number | null {
  if (!s) return null
  const d = toLocalDate(s)
  if (isNaN(+d)) return null
  return Math.floor((Date.now() - +d) / 86400000)
}

export function toCSV(rows: Record<string, unknown>[], cols: { key: string; label: string }[]): string {
  const esc = (v: unknown) => {
    let s = v == null ? '' : String(v)
    // Formula-injection guard: Excel/Sheets execute cells starting with = + - @ tab or CR.
    // Scraped Cargotrack text (names, offices) reaches these exports, so neutralize the trigger.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const head = cols.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(',')).join('\n')
  return head + '\n' + body
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Billing ─────────────────────────────────────────────────────────────────────
/** USD amount, e.g. 32.5 -> "$32.50". Null/NaN -> "—". */
export function fmtUsd(n?: number | null): string {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Weight in pounds, e.g. 1234.5 -> "1.235 lb". Null/NaN -> "—". */
export function fmtLbs(n?: number | null): string {
  if (n == null || isNaN(n)) return '—'
  return `${Math.round(n).toLocaleString('en-US')} lb`
}

/** Money with the agency's working currency symbol: $ for USD, C$ for NIO (córdobas). */
export function fmtMoney(n: number | null | undefined, currency: 'USD' | 'NIO' | undefined): string {
  if (n == null || isNaN(n)) return '—'
  const sym = currency === 'NIO' ? 'C$' : '$'
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Express a total in the OTHER currency at the agency's exchange rate, for the
 * secondary (small) line on invoices: NIO→USD divides, USD→NIO multiplies.
 * Only the amount with its symbol is shown (C$) — the relative sign for the
 * total in córdobas — always 2 decimals, no ≈, no rate.
 * Returns null when the rate is not configured (single-currency invoice).
 */
export function altCurrencyTotal(total: number, currency: 'USD' | 'NIO' | undefined, exchangeRateNioPerUsd: number | null | undefined): string | null {
  if (!exchangeRateNioPerUsd || exchangeRateNioPerUsd <= 0) return null
  if (currency === 'NIO') return fmtMoney(total / exchangeRateNioPerUsd, 'USD')
  if (currency === 'USD') return fmtMoney(total * exchangeRateNioPerUsd, 'NIO')
  return null
}

/**
 * Normalize a stored phone into wa.me digits (no +, no separators).
 * - 11-digit international (505…) → kept as-is.
 * - 8-digit local NI mobile → prefixed 505 (córdoba cell phones without country code).
 * - 10-digit → assumed US +1 (foreign shipments).
 * Returns null when nothing usable comes out.
 */
export function waPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (/^505\d{8}$/.test(digits)) return digits
  if (/^\d{8}$/.test(digits)) return `505${digits}`
  if (/^\d{10}$/.test(digits)) return `1${digits}`
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  ISSUED: 'Emitida',
  PARTIAL: 'Parcial',
  PAID: 'Pagada',
  VOID: 'Anulada',
}

// Soft badge bg+text per invoice status (mirrors the shipment STATUS_SOFT convention).
export const INVOICE_STATUS_SOFT: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ISSUED: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-yellow-50 text-yellow-800',
  PAID: 'bg-green-50 text-green-700',
  VOID: 'bg-red-50 text-red-700',
}

export const INVOICE_STATUS_ORDER = ['DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID']

export const FREIGHT_LABEL: Record<string, string> = { AIR: 'Aéreo', MAR: 'Marítimo' }
export const TIER_LABEL: Record<string, string> = {
  REGULAR: 'Regular',
  ESPECIAL: 'Especial',
  VIP: 'VIP',
  MADRES: 'Madres',
  DARIO: 'Darío',
}
