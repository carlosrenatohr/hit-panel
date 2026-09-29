# 01 · Arquitectura

## Diagrama

```
┌─────────────────────────────────────────────────────────────────────┐
│ Navegador del equipo                                                  │
│   hit-panel (Astro/Preact, estático en Cloudflare Pages)             │
│     · login email+contraseña  →  JWT (InsForge Auth)                  │
│     · lee  packages/events/notes  con el JWT  → RLS autoriza por rol  │
│     · escribe vía RPCs SECURITY DEFINER (set_manual_status, …)        │
└───────────────┬─────────────────────────────────────────────────────┘
                │ HTTPS (anon key pública + Bearer JWT del usuario)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ InsForge  (Postgres + PostgREST + Auth)                              │
│   auth.users · app_users(role) · packages · events · providers …     │
│   RLS: staff lee; escrituras solo por RPC; anon denegado             │
└───────────────▲─────────────────────────────────────────────────────┘
                │ admin key (server-only)
        Worker hit-ever2  ──scrape──▶ Cargotrack (Everest + Global Connection)
        (cron 2h + email trigger) escribe la data; el panel solo la consume
```

## Decisiones clave

1. **InsForge-directo + RLS, no un backend propio para el panel.** El panel habla con InsForge usando
   el JWT del usuario; las políticas RLS deciden qué puede ver/hacer cada rol. Ventajas: menos código
   que mantener, autenticación por usuario real, y **la futura app móvil reusa exactamente lo mismo**
   (mismo Auth, mismos roles, mismas RLS). El sitio público sigue usando el Worker (payload mínimo).

2. **Escrituras por RPC `SECURITY DEFINER`, no UPDATE/INSERT directos.** El staff no tiene políticas de
   escritura sobre las tablas; en su lugar llama funciones controladas (`set_manual_status`,
   `add_package_tag`, `add_package_note`) que validan el rol y tocan solo lo permitido. Evita que un
   cliente manipule columnas que no debe.

3. **Estático en Cloudflare Pages.** El panel es 100% cliente (`client:only`). No hay servidor ni
   secretos en el borde: la **anon key** es pública por diseño y la seguridad real vive en RLS + JWT.

4. **`effective_status` como columna generada** (`coalesce(manual_status, status)`) para filtrar,
   ordenar e indexar por el estado que el cliente realmente ve.

## Flujo de datos (lectura)

1. Usuario entra → `signInWithPassword` → JWT en memoria (refresh por cookie).
2. El panel pide su rol de `app_users` (RLS deja leer su propia fila).
3. Vistas llaman `database.from('packages').select(...)` con filtros PostgREST; RLS filtra filas.
4. Agregados vía `rpc('dashboard_stats')`.

## Flujo de datos (escritura)

1. Acción en el detalle (cambiar estado / etiqueta / nota).
2. `database.rpc('set_manual_status', {...})` → la función verifica `is_staff()` y actualiza.
3. El panel recarga el detalle.

## Frescura de datos (refetch silencioso)

No hay polling. El panel se mantiene fresco por tres vías, todas sobre el bus
compartido `src/lib/dataVersion.ts`:

| Vía | Cuánto pide | Qué refresca |
|---|---|---|
| **Mutación** (`bumpData`) | lo que pida la vista | cuerpo **y** contadores |
| **Focus / visibility** (`bumpList`; throttle 5 s, ventana de frescura 60 s) | **1 request** (la lista) | solo el cuerpo |
| **"Actualizar"** (`rev` local) | todo | cuerpo y contadores |

Dos reglas que evitan el parpadeo y la lluvia de requests de antes:

- **Dos niveles de suscripción.** `useDataVersion()` (tablas, listas, KPIs)
  reacciona a cualquier bump; `useCounterVersion()` (las tarjetas de ciclo de
  vida de Paquetería — 8 requests, uno por estado) solo reacciona a `bumpData`.
  Un alt-tab ya no dispara los contadores.
- **`useFetchGate(key)`.** El spinner solo se pinta cuando cambia la query key
  (filtros/página/org) o cuando el usuario pide "Actualizar". Un refetch con la
  misma key conserva lo que hay en pantalla y cambia los datos en silencio
  (stale-while-revalidate): antes la tabla entera se reemplazaba por el spinner
  al volver a la pestaña.

### Decisiones asociadas (2026-09-29)

- **Caché de datos en el cliente (localStorage / IndexedDB / Service Worker): ninguna esta ronda.**
  Con el refetch silencioso + la ventana de 60 s el costo por foco ya bajó a 1 request, y una caché
  traería invalidación —y con ella un estado obsoleto visible— sin un problema medido que resolver.
  Reconsiderar si sube el volumen por página o si algún día el panel necesita funcionar offline.
- **Cloudflare Queues: diferir**, solo recomendación escrita. El panel no encola nada; las piezas
  candidatas (re-scrape masivo de guías, facturación en background) todavía no existen. Diseño y
  señales de activación: `hit-ever2/docs/scaling-and-hosting.md` §Cloudflare Queues (también
  registrado en `backlog.md` §P3).

Cada fetch completado llama a `markDataFresh()` y `startFocusRefetch` no vuelve
a pedir nada si los datos tienen menos de 60 s.

## Por qué escala

- **Usuarios**: agregar personas = crear un usuario + fila en `app_users`. Sin tocar código.
- **Roles/permisos**: se ajustan en RLS/RPC, no en el cliente.
- **Nuevos clientes (móvil, otra app)**: mismo backend; solo otro frontend.
- **Volumen**: PostgREST pagina/indexa; los índices en `effective_status`/`received_at`/`tracking`
  ya están. Reportes pesados pueden moverse a RPCs/vistas materializadas cuando haga falta.
