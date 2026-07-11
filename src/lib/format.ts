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

export function statusLabel(s?: string | null): string {
  return s ? (STATUS_LABEL[s as ShipmentStatus] ?? s) : '—'
}
export function providerLabel(code?: string | null): string {
  return code ? (PROVIDER_LABEL[code] ?? code) : '—'
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
  const d = new Date(s)
  if (isNaN(+d)) return '—'
  return d.toLocaleDateString('es-NI', { year: 'numeric', month: 'short', day: '2-digit' })
}

export function daysAgo(s?: string | null): number | null {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(+d)) return null
  return Math.floor((Date.now() - +d) / 86400000)
}

export function toCSV(rows: Record<string, unknown>[], cols: { key: string; label: string }[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
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
