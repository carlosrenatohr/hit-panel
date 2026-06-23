import { useEffect, useState } from 'preact/hooks'
import {
  fmtDate,
  fmtDateTime,
  providerLabel,
  SERVICE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  statusLabel,
} from '../lib/format'
import { addNote, addTag, getPackageDetail, setManualStatus } from '../lib/insforge'
import type { PackageDetail, Role, ShipmentStatus } from '../lib/types'
import { Button, inputCls, Spinner, StatusPill } from './ui'

export default function ShipmentDetail({
  guia,
  role,
  onClose,
}: {
  guia: string
  role: Role
  onClose: () => void
}) {
  const [d, setD] = useState<PackageDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [newStatus, setNewStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [tagLabel, setTagLabel] = useState('')
  const [tagValue, setTagValue] = useState('')
  const [noteBody, setNoteBody] = useState('')

  const canWrite = role === 'admin' || role === 'staff'

  async function load() {
    setLoading(true)
    try {
      const det = await getPackageDetail(guia)
      setD(det)
      if (!det) setErr('No se encontró el paquete.')
    } catch {
      setErr('Error al cargar el detalle.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [guia])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setErr((e as Error)?.message ?? 'La acción falló.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        class="scroll-thin h-full w-full max-w-2xl overflow-y-auto bg-neutral-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-400">Guía</div>
            <div class="text-xl font-bold text-secondary">{guia}</div>
          </div>
          {d && <StatusPill s={d.pkg.effective_status as ShipmentStatus} />}
          <button onClick={onClose} class="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        {loading ? (
          <div class="p-6">
            <Spinner label="Cargando detalle…" />
          </div>
        ) : !d ? (
          <p class="p-6 text-red-600">{err}</p>
        ) : (
          <div class="space-y-5 p-5">
            {err && <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

            {/* Facts */}
            <section class="rounded-xl border border-slate-200 bg-white p-4">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Datos del paquete</h3>
              <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Fact k="Proveedor" v={providerLabel(d.pkg.providers?.code)} />
                <Fact k="Tracking" v={d.pkg.tracking_number} mono />
                <Fact k="Casillero" v={d.pkg.casillero} />
                <Fact k="Servicio" v={d.pkg.service_type ? SERVICE_LABEL[d.pkg.service_type] : null} />
                <Fact k="Estado scrapeado" v={statusLabel(d.pkg.status)} />
                <Fact k="Estado efectivo" v={statusLabel(d.pkg.effective_status)} />
                <Fact k="Piezas" v={d.pkg.pieces} />
                <Fact k="Peso (lb)" v={d.pkg.weight_lb} />
                <Fact k="Volumen (cf)" v={d.pkg.volume_cf} />
                <Fact k="Dimensiones" v={d.pkg.dimensions} />
                <Fact k="Origen" v={d.pkg.origin_office} />
                <Fact k="Destino" v={d.pkg.dest_office} />
                <Fact k="Remitente" v={d.pkg.remitente} />
                <Fact k="Referencia" v={d.pkg.referencia_name} />
                <Fact k="Valor declarado" v={d.pkg.declared_value} />
                <Fact k="Recibido" v={fmtDate(d.pkg.received_at)} />
                <Fact k="Último evento" v={fmtDateTime(d.pkg.last_event_at)} />
                <Fact k="Actualizado" v={fmtDateTime(d.pkg.scraped_at)} />
              </dl>
              {d.pkg.description && (
                <p class="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{d.pkg.description}</p>
              )}
              {d.pkg.manual_status && (
                <p class="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
                  Override manual: <b>{statusLabel(d.pkg.manual_status)}</b> por {d.pkg.manual_status_by ?? '—'} ·{' '}
                  {fmtDateTime(d.pkg.manual_status_at)}
                  {d.pkg.manual_status_note ? ` — ${d.pkg.manual_status_note}` : ''}
                </p>
              )}
            </section>

            {/* Timeline */}
            <section class="rounded-xl border border-slate-200 bg-white p-4">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Historial de eventos</h3>
              {d.events.length === 0 ? (
                <p class="text-sm text-slate-400">Sin eventos.</p>
              ) : (
                <ol class="space-y-3">
                  {d.events.map((e) => (
                    <li key={e.id} class="flex gap-3 text-sm">
                      <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div>
                        <div class="text-slate-800">{e.description ?? '—'}</div>
                        <div class="text-xs text-slate-400">
                          {fmtDateTime(e.occurred_at)} {e.office ? `· ${e.office}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Provider notes */}
            {d.providerNotes.length > 0 && (
              <section class="rounded-xl border border-slate-200 bg-white p-4">
                <h3 class="mb-3 text-sm font-semibold text-secondary">Notas del proveedor</h3>
                <ul class="space-y-2">
                  {d.providerNotes.map((n) => (
                    <li key={n.id} class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {n.body}
                      <span class="block text-xs text-slate-400">
                        {n.author ?? '—'} · {n.noted_at ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Internal tags + notes */}
            <section class="rounded-xl border border-slate-200 bg-white p-4">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Etiquetas y notas internas</h3>
              <div class="mb-2 flex flex-wrap gap-2">
                {d.tags.length === 0 && <span class="text-sm text-slate-400">Sin etiquetas.</span>}
                {d.tags.map((t) => (
                  <span key={t.id} class="rounded-full bg-accent-blue/10 px-2 py-0.5 text-xs text-accent-blue">
                    {t.label}
                    {t.value ? `: ${t.value}` : ''}
                  </span>
                ))}
              </div>
              <ul class="space-y-2">
                {d.notes.map((n) => (
                  <li key={n.id} class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {n.body}
                    <span class="block text-xs text-slate-400">
                      {n.created_by ?? '—'} · {fmtDateTime(n.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Actions */}
            {canWrite && (
              <section class="rounded-xl border border-primary/30 bg-white p-4">
                <h3 class="mb-3 text-sm font-semibold text-primary">Acciones</h3>
                <div class="space-y-4">
                  <div>
                    <div class="mb-1 text-xs font-medium text-slate-600">Cambiar estado (override manual)</div>
                    <div class="flex flex-wrap gap-2">
                      <select class={inputCls} value={newStatus} onChange={(e) => setNewStatus((e.target as HTMLSelectElement).value)}>
                        <option value="">Seleccionar…</option>
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <input
                        class={`${inputCls} flex-1`}
                        placeholder="Nota (opcional)"
                        value={statusNote}
                        onInput={(e) => setStatusNote((e.target as HTMLInputElement).value)}
                      />
                      <Button
                        disabled={busy || !newStatus}
                        onClick={() => run(() => setManualStatus(guia, newStatus, statusNote || undefined))}
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div class="mb-1 text-xs font-medium text-slate-600">Agregar etiqueta</div>
                    <div class="flex flex-wrap gap-2">
                      <input class={inputCls} placeholder="Etiqueta" value={tagLabel} onInput={(e) => setTagLabel((e.target as HTMLInputElement).value)} />
                      <input class={`${inputCls} flex-1`} placeholder="Valor (opcional)" value={tagValue} onInput={(e) => setTagValue((e.target as HTMLInputElement).value)} />
                      <Button
                        variant="ghost"
                        disabled={busy || !tagLabel}
                        onClick={() => run(async () => { await addTag(guia, tagLabel, tagValue || undefined); setTagLabel(''); setTagValue('') })}
                      >
                        Agregar
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div class="mb-1 text-xs font-medium text-slate-600">Nota interna</div>
                    <div class="flex gap-2">
                      <textarea
                        class={`${inputCls} flex-1`}
                        rows={2}
                        placeholder="Escribe una nota interna…"
                        value={noteBody}
                        onInput={(e) => setNoteBody((e.target as HTMLTextAreaElement).value)}
                      />
                      <Button
                        variant="ghost"
                        disabled={busy || !noteBody.trim()}
                        onClick={() => run(async () => { await addNote(guia, noteBody.trim()); setNoteBody('') })}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Fact({ k, v, mono }: { k: string; v: unknown; mono?: boolean }) {
  const val = v === null || v === undefined || v === '' ? '—' : String(v)
  return (
    <div>
      <dt class="text-xs text-slate-400">{k}</dt>
      <dd class={`text-slate-800 ${mono ? 'break-all font-mono text-xs' : ''}`}>{val}</dd>
    </div>
  )
}
