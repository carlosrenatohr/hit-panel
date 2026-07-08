export type ShipmentStatus =
  | 'en_almacen'
  | 'parcial'
  | 'en_transito'
  | 'en_destino'
  | 'entregado'
  | 'excepcion'
  | 'desconocido'

export type ServiceType = 'aereo' | 'maritimo' | null
export type Role = 'admin' | 'staff' | 'viewer'

export interface Provider {
  id?: string
  code: string
  name: string
  base_url?: string
}

export interface Pkg {
  id: string
  almacen_id: string
  tracking_number: string | null
  status: ShipmentStatus
  manual_status: ShipmentStatus | null
  effective_status: ShipmentStatus
  raw_status: string | null
  service_type: ServiceType
  weight_lb: number | null
  volume_cf: number | null
  pieces: number | null
  dimensions: string | null
  origin_office: string | null
  dest_office: string | null
  description: string | null
  remitente: string | null
  referencia_name: string | null
  casillero: string | null
  declared_value: number | null
  photo_ref: string | null
  received_at: string | null
  last_event_at: string | null
  scraped_at: string | null
  manual_status_by: string | null
  manual_status_note: string | null
  manual_status_at: string | null
  provider_id: string
  providers?: Provider
}

export interface Evt {
  id: string
  occurred_at: string | null
  office: string | null
  description: string | null
  status: ShipmentStatus | null
  source: string | null
}

export interface ProviderNote {
  id: string
  body: string
  author: string | null
  noted_at: string | null
}

export interface Tag {
  id: string
  label: string
  value: string | null
  created_by: string | null
  created_at: string
}

export interface Note {
  id: string
  body: string
  created_by: string | null
  created_at: string
}

export interface Stats {
  total: number
  by_status: Record<string, number>
  by_provider: Record<string, number>
  last_scraped: Record<string, string | null>
  delivered_30d: number
}

export interface SessionUser {
  id: string
  email: string
  role: Role
  name: string | null
}

export interface PackageDetail {
  pkg: Pkg
  events: Evt[]
  providerNotes: ProviderNote[]
  tags: Tag[]
  notes: Note[]
}
