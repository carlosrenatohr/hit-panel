import type { ShipmentStatus } from './types'

// Customer-facing Spanish labels (same vocabulary as the public tracker and WhatsApp scripts).
export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  en_almacen: 'En bodega Miami',
  parcial: 'Parcial',
  en_transito: 'En tránsito',
  en_destino: 'En destino (Nicaragua)',
  entregado: 'Entregado',
  excepcion: 'Excepción',
  desconocido: 'Desconocido',
}

// Pill styling per the official Cargotrack legend (green→orange pipeline).
export const STATUS_STYLE: Record<ShipmentStatus, string> = {
  en_almacen: 'bg-green-100 text-green-800 ring-green-600/20',
  parcial: 'bg-yellow-100 text-yellow-900 ring-yellow-600/30',
  en_transito: 'bg-red-100 text-red-800 ring-red-600/20',
  en_destino: 'bg-purple-100 text-purple-800 ring-purple-600/20',
  entregado: 'bg-orange-100 text-orange-800 ring-orange-600/20',
  excepcion: 'bg-slate-200 text-slate-800 ring-slate-600/20',
  desconocido: 'bg-slate-100 text-slate-600 ring-slate-500/20',
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

export const SERVICE_LABEL: Record<string, string> = { aereo: 'Aéreo', maritimo: 'Marítimo' }
export const PROVIDER_LABEL: Record<string, string> = {
  everest: 'Everest',
  global_connection: 'Global Connection',
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
