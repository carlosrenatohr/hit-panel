import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  downloadCSV,
  providerLabel,
  SERVICE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  toCSV,
} from '../lib/format'
import { exportPackages } from '../lib/insforge'
import type { Pkg, ShipmentStatus } from '../lib/types'
import { Button, Card, inputCls, Spinner, StatusPill } from './ui'

export default function Reports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<Pkg[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    exportPackages({ from: from || undefined, to: to || undefined }, 5000)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setErr('No se pudieron cargar los datos.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [from, to])

  const agg = useMemo(() => {
    const providers = Array.from(new Set(rows.map((r) => r.providers?.code ?? 'desconocido'))).sort()
    const matrix: Record<string, Record<string, number>> = {}
    const service: Record<string, number> = { aereo: 0, maritimo: 0, '—': 0 }
    const byMonth: Record<string, number> = {}
    for (const r of rows) {
      const s = r.effective_status
      const pc = r.providers?.code ?? 'desconocido'
      matrix[s] = matrix[s] || {}
      matrix[s][pc] = (matrix[s][pc] ?? 0) + 1
      const svc = r.service_type ?? '—'
      service[svc] = (service[svc] ?? 0) + 1
      const m = r.received_at ? r.received_at.slice(0, 7) : '—'
      byMonth[m] = (byMonth[m] ?? 0) + 1
    }
    return { providers, matrix, service, byMonth }
  }, [rows])

  function exportMatrix() {
    const cols = [{ key: 'estado', label: 'Estado' }, ...agg.providers.map((p) => ({ key: p, label: providerLabel(p) })), { key: 'total', label: 'Total' }]
    const data = STATUS_ORDER.filter((s) => agg.matrix[s]).map((s) => {
      const row: Record<string, unknown> = { estado: STATUS_LABEL[s] }
      let total = 0
      for (const p of agg.providers) {
        const n = agg.matrix[s]?.[p] ?? 0
        row[p] = n
        total += n
      }
      row.total = total
      return row
    })
    downloadCSV(`reporte-estados-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data, cols))
  }

  function exportDetailed() {
    const cols = [
      { key: 'almacen_id', label: 'Guia' },
      { key: 'tracking_number', label: 'Tracking' },
      { key: 'provider', label: 'Proveedor' },
      { key: 'effective_status', label: 'Estado' },
      { key: 'service_type', label: 'Servicio' },
      { key: 'pieces', label: 'Piezas' },
      { key: 'weight_lb', label: 'Peso' },
      { key: 'origin_office', label: 'Origen' },
      { key: 'dest_office', label: 'Destino' },
      { key: 'received_at', label: 'Recibido' },
      { key: 'last_event_at', label: 'Ultimo evento' },
    ]
    const flat = rows.map((p) => ({ ...p, provider: providerLabel(p.providers?.code) }))
    downloadCSV(`reporte-detallado-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(flat, cols))
  }

  return (
    <div class="mx-auto max-w-6xl space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-secondary">Reportes</h1>
          <p class="text-sm text-slate-500">{rows.length} paquetes en el rango seleccionado.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Desde
            <input type="date" class={inputCls} value={from} onChange={(e) => setFrom((e.target as HTMLInputElement).value)} />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Hasta
            <input type="date" class={inputCls} value={to} onChange={(e) => setTo((e.target as HTMLInputElement).value)} />
          </label>
          <Button variant="ghost" onClick={exportMatrix}>⬇︎ Estados</Button>
          <Button variant="ghost" onClick={exportDetailed}>⬇︎ Detallado</Button>
        </div>
      </div>

      {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {loading ? (
        <Spinner label="Calculando reportes…" />
      ) : (
        <>
          {/* Status x provider matrix */}
          <Card>
            <div class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-secondary">
              Estado × proveedor
            </div>
            <div class="scroll-thin overflow-x-auto">
              <table class="w-full min-w-[480px] text-sm">
                <thead>
                  <tr class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th class="px-4 py-2">Estado</th>
                    {agg.providers.map((p) => (
                      <th key={p} class="px-4 py-2 text-right">
                        {providerLabel(p)}
                      </th>
                    ))}
                    <th class="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_ORDER.filter((s) => agg.matrix[s]).map((s) => {
                    const total = agg.providers.reduce((a, p) => a + (agg.matrix[s]?.[p] ?? 0), 0)
                    return (
                      <tr key={s} class="border-t border-slate-100">
                        <td class="px-4 py-2">
                          <StatusPill s={s as ShipmentStatus} />
                        </td>
                        {agg.providers.map((p) => (
                          <td key={p} class="px-4 py-2 text-right text-slate-700">
                            {agg.matrix[s]?.[p] ?? 0}
                          </td>
                        ))}
                        <td class="px-4 py-2 text-right font-semibold text-secondary">{total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div class="grid gap-5 md:grid-cols-2">
            <Card>
              <div class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-secondary">Por servicio</div>
              <div class="space-y-2 p-5 text-sm">
                {Object.entries(agg.service).map(([k, n]) => (
                  <div key={k} class="flex justify-between">
                    <span class="text-slate-600">{k === '—' ? 'Sin servicio' : SERVICE_LABEL[k] ?? k}</span>
                    <span class="font-medium text-slate-800">{n}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div class="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-secondary">Recibidos por mes</div>
              <div class="space-y-2 p-5 text-sm">
                {Object.entries(agg.byMonth)
                  .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                  .map(([m, n]) => (
                    <div key={m} class="flex justify-between">
                      <span class="text-slate-600">{m}</span>
                      <span class="font-medium text-slate-800">{n}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
