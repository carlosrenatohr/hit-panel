# 04 · Acceso admin y gestión de usuarios

## Entrar la primera vez (admin de prueba)

1. Abre `https://hit-panel.pages.dev`.
2. Usuario: **`admin@hit-cargo.com`**.
3. Contraseña: **entregada por separado** (archivo local `ADMIN-CREDENTIALS.local.txt`, no versionado en git).
   **Rótala apenas entres** (ver "Cambiar contraseña" abajo).

Este usuario tiene rol `admin` (en `app_users`) y su email ya está verificado. Fue creado durante el
seed inicial. No se versiona la contraseña en git por seguridad.

## Cómo se crea un usuario (modelo)

Un usuario del panel son **dos cosas**:
1. Una cuenta en **InsForge Auth** (`auth.users`) con email + contraseña.
2. Una fila en **`public.app_users`** con su **rol** (`admin`/`staff`/`viewer`) y `active=true`.

Sin la fila #2 (o con `active=false`), la persona **no entra** aunque tenga cuenta de Auth.

> Hoy la creación es un procedimiento operativo (abajo). Una **UI de gestión de usuarios** dentro del
> panel está en el roadmap (doc 09); la RLS ya permite que un `admin` gestione `app_users`.

## Crear un usuario nuevo (procedimiento)

Desde `hit-ever2/` (proyecto InsForge linkeado). Reemplaza correo/nombre/rol:

```bash
BASE="https://a4qvtp8s.us-east.insforge.app"
ANON=$(npx @insforge/cli secrets get ANON_KEY --json | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('value') or d.get('ANON_KEY'))")

EMAIL="maya@hit-cargo.com"; NAME="Maya"; ROLE="staff"; PW="<contraseña-inicial-fuerte>"

# 1) crear la cuenta de Auth
curl -s -X POST "$BASE/api/auth/users" -H "Content-Type: application/json" -H "Authorization: Bearer $ANON" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"name\":\"$NAME\"}"

# 2) (si la verificación de email está activa) confirmar para que pueda entrar ya
npx @insforge/cli db query "update auth.users set email_verified=true where email='$EMAIL'"

# 3) darle rol en el panel
npx @insforge/cli db query \
  "insert into public.app_users(id,email,name,role,active)
   select id,'$EMAIL','$NAME','$ROLE',true from auth.users where email='$EMAIL'
   on conflict(id) do update set role=excluded.role, active=true, name=excluded.name"
```

La persona entra con ese email + contraseña y debería cambiarla.

> **Alternativa recomendada a futuro:** activar invitaciones por correo (el usuario define su propia
> contraseña) en vez de asignar una inicial. Requiere configurar SMTP/redirect en InsForge (`config`).

## Cambiar el rol de alguien

```bash
npx @insforge/cli db query "update public.app_users set role='admin' where email='maya@hit-cargo.com'"
```

## Desactivar / reactivar (sin borrar)

```bash
npx @insforge/cli db query "update public.app_users set active=false where email='persona@hit-cargo.com'"
# reactivar: active=true
```

`active=false` corta el acceso inmediatamente (la próxima verificación de sesión devuelve null).

## Quitar un usuario por completo

```bash
# borra la fila de rol (deja la cuenta de Auth):
npx @insforge/cli db query "delete from public.app_users where email='persona@hit-cargo.com'"
# y si quieres borrar también la cuenta de Auth (irreversible):
npx @insforge/cli db query "delete from auth.users where email='persona@hit-cargo.com'"
```

## Cambiar contraseña / reset

- **Self-service**: flujo de "olvidé mi contraseña" de InsForge Auth (requiere SMTP configurado).
  Endpoints REST: solicitar reset → `exchangeResetPasswordToken`. Ver `npx @insforge/cli docs auth rest-api`.
- **Por un admin (rápido)**: re-crear la contraseña vía API de Auth, o pedirle a la persona que use el
  reset. Evita editar el hash a mano.

## Verificación de email

La verificación está **activa** por defecto. Por eso el procedimiento incluye marcar `email_verified`
para usuarios creados por un operador. Si activas invitaciones/SMTP, cada quien verifica su propio correo.
