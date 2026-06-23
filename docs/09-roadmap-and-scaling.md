# 09 · Roadmap y escalado

El panel es un MVP sólido y desplegado. Crece sin reescritura porque la base (Auth + RLS + RPCs) ya es
la de un SaaS multiusuario. Lo siguiente, por prioridad:

## Corto plazo

- **UI de gestión de usuarios** dentro del panel (solo `admin`): crear/invitar, cambiar rol, activar/
  desactivar. Hoy es procedimiento por CLI (doc 04); la RLS ya lo permite, falta la pantalla.
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
