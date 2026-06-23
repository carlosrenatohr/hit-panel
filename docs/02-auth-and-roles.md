# 02 · Autenticación y roles

## Mecanismo

- **InsForge Auth** con **email + contraseña**. `signInWithPassword` devuelve un **JWT** (access token)
  que el SDK adjunta a cada request. El refresh usa una cookie httpOnly + CSRF (manejado por el SDK).
- El JWT lleva el `sub` (= `auth.users.id`); en Postgres, `auth.uid()` lo expone para las políticas RLS.
- El panel resuelve el **rol** leyendo `public.app_users` (la RLS deja que cada quien lea su propia fila).

## Tabla `app_users`

Vincula un usuario de `auth.users` con su rol de staff:

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid (PK, FK→`auth.users`) | mismo id del usuario de Auth |
| `email` | text | correo (copia para mostrar) |
| `name` | text | nombre a mostrar |
| `role` | enum `staff_role` | `admin` \| `staff` \| `viewer` |
| `active` | boolean | `false` desactiva el acceso sin borrar el usuario |
| `created_at` | timestamptz | |

> Un usuario de `auth.users` **sin** fila en `app_users` (o con `active=false`) **no entra** al panel:
> `currentUser()` devuelve `null` y se muestra el login.

## Roles

| Rol | Puede ver | Puede escribir (estado/etiquetas/notas) | Gestionar usuarios |
|-----|-----------|------------------------------------------|--------------------|
| `admin` | todo | sí | sí (RLS sobre `app_users`) |
| `staff` | todo | sí | no |
| `viewer` | todo | no (UI oculta acciones; RPCs igual exigen staff) | no |

La distinción se aplica en **dos capas**:
- **UI**: el detalle solo muestra el bloque de "Acciones" a `admin`/`staff`.
- **Backend**: los RPCs de escritura exigen `is_staff()`; `dashboard_stats`/lecturas exigen estar en
  `app_users` activo. Aunque alguien edite el cliente, sin rol válido no escribe.

## Helpers SQL (en `public`, `SECURITY DEFINER`)

- `is_staff()` → ¿el usuario actual está en `app_users` y activo?
- `is_admin()` → ¿además es `admin`?
- `current_staff_role()` → su rol.

Son `SECURITY DEFINER` para evitar recursión de RLS al consultarse desde políticas.

## Sesión y persistencia

- El access token vive **en memoria**; en recarga, el SDK rehidrata con la cookie de refresh.
- **Nota cross-domain**: el panel (`*.pages.dev`) y InsForge (`*.insforge.app`) son dominios distintos,
  así que la cookie de refresh es de terceros. Algunos navegadores la bloquean → en una recarga dura
  podría pedir login otra vez (la sesión activa funciona normal). Se elimina alineando dominios
  (ej. `panel.hit-cargo.com` + subdominio propio de InsForge). Ver `06-deployment-and-ops.md`.

## Verificación

Se validó end-to-end (login → JWT → `dashboard_stats` → lectura RLS de `packages` → rol admin) con
el usuario inicial. Ver `04-admin-access-and-user-management.md`.
