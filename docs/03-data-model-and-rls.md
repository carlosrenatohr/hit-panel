# 03 · Modelo de datos y RLS

Las tablas de operación las crea/llena el Worker `hit-ever2` (ver sus migraciones `db/0001_init.sql` y
`db/0002_provider_notes.sql`). El panel agrega **auth/roles + RLS + RPCs** en dos migraciones nuevas.

## Tablas (resumen)

| Tabla | Rol |
|-------|-----|
| `packages` | paquete: guía (`almacen_id`), `tracking_number`, `status`, `manual_status`, **`effective_status`** (generada), servicio, peso, piezas, oficinas, `casillero`, `referencia_name`, `declared_value`, fechas, `provider_id` |
| `events` | historial por paquete (fecha, oficina, descripción, estado) |
| `providers` | `everest`, `global_connection` (code, name, `casillero_filter`) |
| `package_provider_notes` | notas que vienen de Cargotrack (incluye `RETIRADO`) |
| `package_tags` / `package_notes` | etiquetas y notas **internas** de HIT |
| `app_users` | usuarios del panel + rol (ver doc 02) |

## `effective_status` (columna generada)

```sql
alter table public.packages
  add column effective_status public.shipment_status
  generated always as (coalesce(manual_status, status)) stored;
```

Es el estado que el cliente realmente ve (el override manual gana). Indexada → se filtra/ordena rápido.
Enum `shipment_status`: `en_almacen, parcial, en_transito, en_destino, entregado, excepcion, desconocido`.

## RLS

- Todas las tablas tienen RLS activa. **`anon` no tiene políticas → denegado** (el sitio público no
  lee InsForge directo; lo sirve el Worker con admin key).
- Para `authenticated`:
  - `packages/events/providers/package_tags/package_notes/package_provider_notes`: **SELECT** si
    `is_staff()`. (Sin INSERT/UPDATE/DELETE directos — las escrituras van por RPC.)
  - `app_users`: cada quien lee su fila; `admin` lee/gestiona todas.

## RPCs (escritura, `SECURITY DEFINER`, exigen `is_staff()`)

| RPC | Parámetros | Efecto |
|-----|-----------|--------|
| `set_manual_status(p_guia, p_status, p_note)` | guía, estado enum, nota opcional | setea `manual_status*` (override) |
| `add_package_tag(p_guia, p_label, p_value)` | guía, etiqueta, valor opcional | inserta en `package_tags` |
| `add_package_note(p_guia, p_body)` | guía, texto | inserta en `package_notes` |
| `dashboard_stats()` | — | agregados para el Resumen (totales, por estado, por proveedor, última ingesta) |

## Migraciones (en `hit-ever2/migrations/`)

Se aplican con `npx @insforge/cli db migrations up --all` (proyecto linkeado).

| Archivo | Contenido |
|---------|-----------|
| `20260623015746_dashboard-auth.sql` | `app_users`, enum `staff_role`, helpers `is_staff/is_admin/current_staff_role`, políticas RLS staff, RPCs de escritura, `dashboard_stats` |
| `20260623020252_dashboard-effective-status.sql` | columna generada `effective_status` + índices (`effective_status`, `received_at`, `tracking_number`) |

> Cambios futuros de esquema: **siempre por migración** (`db migrations new …`), nunca editando prod a mano.
