# 09 · Roadmap y escalado

El panel es un MVP sólido y desplegado. Crece sin reescritura porque la base (Auth + RLS + RPCs) ya es
la de un SaaS multiusuario. Lo siguiente, por prioridad:

## Corto plazo

- **UI de gestión de usuarios** dentro del panel (solo `admin`): crear/invitar, cambiar rol, activar/
  desactivar. Hoy es procedimiento por CLI (doc 04); la RLS ya lo permite, falta la pantalla.
- **Botón "Refrescar ahora" en el detalle de un envío** — llama a `POST /admin/packages/:guia/refresh`
  del Worker (`hit-ever2`), que ya existe y fuerza el re-scrape de un paquete puntual sin esperar su
  turno de cron. Pensado para `admin`/futuro `superadmin` únicamente (no `staff`/`viewer`) — es una
  acción que golpea Cargotrack en vivo, no solo lee la base.
  **Ojo con la arquitectura antes de construirlo:** ese endpoint del Worker se autentica con
  `ADMIN_SECRET` (un secreto compartido), NO con el JWT por-usuario que usa el resto del panel — **no
  se puede llamar directo desde el navegador** sin exponer ese secreto (cualquiera con devtools lo
  extraería y podría disparar cualquier `/admin/*`, incluido un backfill completo). Antes de agregar
  el botón, hace falta un intermediario que nunca mande el secreto al cliente:
  1. **Recomendado — InsForge Edge Function**: una función server-side que (a) valida el JWT del
     que llama y confirma `role IN ('admin', ...)` en `app_users` (usa la API key admin de InsForge,
     bypassa RLS, nunca se expone), (b) le pega al Worker con `ADMIN_SECRET` desde el servidor
     (guardado como secret de la función, nunca en el bundle del panel), (c) devuelve el resultado.
  2. Alternativa: una ruta nueva en el Worker que acepte el JWT de InsForge en vez del secreto
     compartido (validarlo contra InsForge) — más cambio en `hit-ever2`, evita el salto extra por la
     Edge Function.
  - **Rate-limit/cooldown**: agregar un cooldown por guía (ej. 5 min) para que el botón no se preste a
    "refrescar" en loop y termine pegándole feo a Cargotrack (sesión única, footprint).
- **Invitaciones por correo** (self-service de contraseña) → configurar SMTP/redirect en InsForge `config`.
- **Rotar la contraseña del admin inicial** y crear los usuarios reales del equipo.
- **Audit log**: tabla `panel_audit` (quién, qué RPC, qué guía, cuándo) escrita desde los RPCs de
  escritura. Da trazabilidad de overrides/notas.

## Mediano plazo

- **Dominio propio** `panel.hit-cargo.com` + alinear InsForge en `*.hit-cargo.com` (cookies de primera
  parte, sesión persistente perfecta).
- **Más reportes**: tiempos por etapa (almacén→tránsito→destino→entregado), entregas por semana,
  paquetes estancados como vista dedicada, export programado.
- **Realtime**: suscripción a cambios de `packages` (InsForge realtime) para que el panel se actualice
  solo cuando el cron/trigger ingiere.
- **Búsqueda full-text** (descripción/remitente) con índice GIN si el volumen lo pide.

## Largo plazo

- **App móvil** (doc 07): mismo Auth/RLS; rol `customer` para que el cliente vea sus paquetes.
- **Portal de clientes** web con el mismo backend.
- **Escala de datos**: hoy ~decenas/cientos de paquetes. PostgREST pagina + hay índices
  (`effective_status`, `received_at`, `tracking_number`). Si crece a miles/día: vistas materializadas
  para reportes, particionado por fecha, y mover agregados pesados a RPCs.

## Cómo escala cada eje

| Eje | Hoy | Cómo crece |
|-----|-----|-----------|
| Usuarios | seed admin + CLI | UI de gestión; invitaciones; SSO/OAuth |
| Permisos | admin/staff/viewer | nuevos roles (`customer`) + RLS específica |
| Frontends | panel web | + app móvil + portal cliente, mismo backend |
| Datos | lectura directa + RPCs | vistas materializadas, realtime, full-text |
| Operación | deploy manual a Pages | auto-build desde GitHub; dominio propio |

> Principio: la **autorización vive en la base** (RLS + RPCs), no en el cliente. Cualquier frontend
> nuevo hereda seguridad y reglas sin duplicarlas.
