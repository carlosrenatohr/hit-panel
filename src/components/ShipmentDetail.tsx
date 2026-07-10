import { Anchor, Check, CheckCircle2, Copy, Package, Plane, StickyNote, Tag, X } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import {
  cleanName,
  daysAgo,
  fmtDate,
  fmtDateTime,
  isHazmat,
  officeFlag,
  PIPELINE_STAGES,
  PIPELINE_STEP,
  providerLabel,
  STATUS_LABEL,
  STATUS_ORDER,
  statusLabel,
} from '../lib/format'
import { addNote, addTag, getPackageDetail, setManualStatus } from '../lib/insforge'
import type { PackageDetail, Role, ShipmentStatus } from '../lib/types'
import { Button, DaysBadge, HazmatBadge, IconButton, inputCls, Spinner, StatusPill } from './ui'

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
  const [copied, setCopied] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (photoOpen) setPhotoOpen(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, photoOpen])

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

  function copyTracking(tracking: string) {
    navigator.clipboard?.writeText(tracking)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const step = d ? PIPELINE_STEP[d.pkg.effective_status as ShipmentStatus] : 0
  const providerBase = d?.pkg.providers?.base_url?.replace(/\/$/, '')
  const providerUrl = providerBase ? `${providerBase}/appl2.0/agent/whs_detail.asp?id=${guia}` : null
  const parcelUrl = d?.pkg.tracking_number
    ? `https://parcelsapp.com/en/tracking/${encodeURIComponent(d.pkg.tracking_number)}`
    : null

  return (
    <div
      class="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle del envío ${guia}`}
    >
      <div
        class="scroll-thin h-full w-full max-w-2xl overflow-y-auto bg-neutral-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium uppercase tracking-wide text-gray-400">Guía</span>
              <span class="text-xl font-bold tracking-tight text-secondary">{guia}</span>
            </div>
            {d?.pkg.tracking_number && (
              <button
                onClick={() => copyTracking(d.pkg.tracking_number as string)}
                class="mt-0.5 flex items-center gap-1 truncate font-mono text-xs text-gray-400 hover:text-gray-600"
                title="Copiar número de tracking"
              >
                {copied ? <Check class="h-3 w-3 text-green-600" /> : <Copy class="h-3 w-3" />}
                {d.pkg.tracking_number}
              </button>
            )}
          </div>
          {d && <StatusPill s={d.pkg.effective_status as ShipmentStatus} class="shrink-0" />}
          <IconButton label="Cerrar" onClick={onClose}>
            <X class="h-4 w-4" aria-hidden="true" />
          </IconButton>
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

            {/* Pipeline + at-a-glance */}
            <section class="rounded-xl border border-gray-100 bg-white p-4">
              <div class="mb-4 grid grid-cols-4 gap-1">
                {PIPELINE_STAGES.map((label, i) => {
                  const idx = i + 1
                  const done = step >= idx
                  return (
                    <div key={label} class="text-center">
                      <div class={`h-1.5 rounded-full ${done ? 'bg-primary' : 'bg-gray-100'}`} />
                      <div class={`mt-1.5 text-[11px] ${done ? 'font-medium text-secondary' : 'text-gray-400'}`}>
                        {label}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div class="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 text-sm">
                <span class="flex items-center gap-1.5 font-medium text-gray-800">
                  {cleanName(d.pkg.referencia_name)}
                  {isHazmat(d.pkg.referencia_name) && <HazmatBadge />}
                </span>
                <span class="flex items-center gap-1.5 text-gray-600">
                  {d.pkg.service_type === 'maritimo' ? (
                    <Anchor class="h-4 w-4 text-accent-blue" aria-hidden="true" />
                  ) : (
                    <Plane class="h-4 w-4 text-accent-blue" aria-hidden="true" />
                  )}
                  {d.pkg.service_type === 'maritimo' ? 'Marítimo' : 'Aéreo'} {officeFlag(d.pkg.origin_office)}
                </span>
                <span class="flex items-center gap-1.5 text-gray-600">
                  <Package class="h-4 w-4 text-gray-400" aria-hidden="true" />
                  {d.pkg.pieces ?? '—'} pzs{d.pkg.weight_lb ? ` · ${d.pkg.weight_lb} lb` : ''}
                </span>
                <span class="text-gray-500">{providerLabel(d.pkg.providers?.code)}</span>
              </div>
              {d.pkg.received_at && (
                <div
                  class="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm text-gray-600"
                  title="Fecha en que se recibió el paquete en la bodega de Miami (primer evento)"
                >
                  <span class="text-xs font-medium uppercase tracking-wide text-gray-400">Recibido en Miami</span>
                  <span class="font-medium text-gray-800">{fmtDate(d.pkg.received_at)}</span>
                  {d.pkg.effective_status !== 'entregado' &&
                    daysAgo(d.pkg.received_at) !== null && <DaysBadge days={daysAgo(d.pkg.received_at) as number} />}
                </div>
              )}
              {(d.pkg.photo_ref || providerUrl || parcelUrl) && (
                <div class="mt-3 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3 text-sm">
                  {d.pkg.photo_ref && (
                    <button
                      type="button"
                      onClick={() => setPhotoOpen(true)}
                      class="flex items-center gap-1.5 text-gray-600 hover:text-primary"
                    >
                      <img src={d.pkg.photo_ref} alt="Foto del paquete" class="h-8 w-8 rounded object-cover ring-1 ring-gray-200" />
                      🖼️ Ver foto
                    </button>
                  )}
                  {providerUrl && (
                    <a href={providerUrl} target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-gray-600 hover:text-primary">
                      🔗 Ver en {providerLabel(d.pkg.providers?.code)}
                    </a>
                  )}
                  {parcelUrl && (
                    <a href={parcelUrl} target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 text-gray-600 hover:text-primary">
                      📦 Rastrear en Parcel
                    </a>
                  )}
                </div>
              )}
              {d.pkg.description && <p class="mt-3 text-sm text-gray-600">{d.pkg.description}</p>}
              {d.pkg.manual_status && (
                <p class="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
                  Override manual: <b>{statusLabel(d.pkg.manual_status)}</b> por {d.pkg.manual_status_by ?? '—'} ·{' '}
                  {fmtDateTime(d.pkg.manual_status_at)}
                  {d.pkg.manual_status_note ? ` — ${d.pkg.manual_status_note}` : ''}
                </p>
              )}
            </section>

            {/* Timeline */}
            <section class="rounded-xl border border-gray-100 bg-white p-4">
              <h3 class="mb-3 text-sm font-semibold text-secondary">Historial de eventos</h3>
              {d.events.length === 0 ? (
                <p class="text-sm text-gray-400">Sin eventos.</p>
              ) : (
                <ol class="ml-1 space-y-4 border-l-2 border-gray-100 pl-4">
                  {d.events.map((e, i) => (
                    <li key={e.id} class="relative text-sm">
                      <span
                        class={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${
                          i === d.events.length - 1 ? 'bg-primary' : 'bg-gray-300'
                        }`}
                      />
                      <div class="text-gray-800">{e.description ?? '—'}</div>
                      <div class="text-xs text-gray-400">
                        {fmtDateTime(e.occurred_at)} {e.office ? `· ${e.office}` : ''}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Provider notes */}
            {d.providerNotes.length > 0 && (
              <section class="rounded-xl border border-gray-100 bg-white p-4">
                <h3 class="mb-3 text-sm font-semibold text-secondary">Notas del proveedor</h3>
                <ul class="space-y-2">
                  {d.providerNotes.map((n) => (
                    <li key={n.id} class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      {n.body}
                      <span class="block text-xs text-gray-400">
                        {n.author ?? '—'} · {n.noted_at ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Internal tags + notes */}
            <section class="rounded-xl border border-gray-100 bg-white p-4">
              <h3 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-secondary">
                <Tag class="h-4 w-4 text-gray-400" aria-hidden="true" /> Etiquetas y notas internas
              </h3>
              <div class="mb-3 flex flex-wrap gap-2">
                {d.tags.length === 0 && <span class="text-sm text-gray-400">Sin etiquetas.</span>}
                {d.tags.map((t) => (
                  <span key={t.id} class="rounded-full bg-accent-blue/10 px-2.5 py-1 text-xs font-medium text-accent-blue">
                    {t.label}
                    {t.value ? `: ${t.value}` : ''}
                  </span>
                ))}
              </div>
              <ul class="space-y-2">
                {d.notes.map((n) => (
                  <li key={n.id} class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {n.body}
                    <span class="block text-xs text-gray-400">
                      {n.created_by ?? '—'} · {fmtDateTime(n.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Internal details (secondary, collapsed by default) */}
            <details class="rounded-xl border border-gray-100 bg-white p-4">
              <summary class="cursor-pointer select-none text-sm font-medium text-gray-500">Detalles internos</summary>
              <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-sm">
                <Fact k="Casillero" v={d.pkg.casillero} />
                <Fact k="Referencia" v={d.pkg.referencia_name} />
                <Fact k="Remitente" v={d.pkg.remitente} />
                <Fact k="Valor declarado" v={d.pkg.declared_value} />
                <Fact k="Dimensiones" v={d.pkg.dimensions} />
                <Fact k="Volumen (cf)" v={d.pkg.volume_cf} />
                <Fact k="Origen" v={d.pkg.origin_office} />
                <Fact k="Destino" v={d.pkg.dest_office} />
                <Fact k="Estado scrapeado" v={statusLabel(d.pkg.status)} />
                <Fact k="Recibido" v={fmtDate(d.pkg.received_at)} />
                <Fact k="Actualizado" v={fmtDateTime(d.pkg.scraped_at)} />
              </dl>
            </details>

            {/* Actions */}
            {canWrite && (
              <section class="rounded-xl border-l-4 border-primary bg-white p-4 shadow-sm">
                <h3 class="mb-3 text-sm font-semibold text-secondary">Acciones</h3>
                <div class="space-y-4">
                  <div>
                    <div class="mb-1 text-xs font-medium text-gray-500">Cambiar estado (override manual)</div>
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
                        <CheckCircle2 class="h-4 w-4" aria-hidden="true" /> Aplicar
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div class="mb-1 text-xs font-medium text-gray-500">Agregar etiqueta</div>
                    <div class="flex flex-wrap gap-2">
                      <input class={inputCls} placeholder="Etiqueta" value={tagLabel} onInput={(e) => setTagLabel((e.target as HTMLInputElement).value)} />
                      <input class={`${inputCls} flex-1`} placeholder="Valor (opcional)" value={tagValue} onInput={(e) => setTagValue((e.target as HTMLInputElement).value)} />
                      <Button
                        variant="ghost"
                        disabled={busy || !tagLabel}
                        onClick={() => run(async () => { await addTag(guia, tagLabel, tagValue || undefined); setTagLabel(''); setTagValue('') })}
                      >
                        <Tag class="h-4 w-4" aria-hidden="true" /> Agregar
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div class="mb-1 text-xs font-medium text-gray-500">Nota interna</div>
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
                        <StickyNote class="h-4 w-4" aria-hidden="true" /> Guardar
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {photoOpen && d?.pkg.photo_ref && (
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPhotoOpen(false)}>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setPhotoOpen(false)}
            class="absolute right-4 top-4 rounded-lg p-2 text-white hover:bg-white/10"
          >
            <X class="h-5 w-5" aria-hidden="true" />
          </button>
          <img
            src={d.pkg.photo_ref}
            alt="Foto del paquete"
            class="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

function Fact({ k, v }: { k: string; v: unknown }) {
  const val = v === null || v === undefined || v === '' ? '—' : String(v)
  return (
    <div>
      <dt class="text-xs text-gray-400">{k}</dt>
      <dd class="text-gray-700">{val}</dd>
    </div>
  )
}
