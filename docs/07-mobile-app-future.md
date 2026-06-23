# 07 · App móvil a futuro (auth individual segura)

El panel se diseñó para que una **app móvil** (clientes y/o equipo) reuse **el mismo backend** sin
reescribir autenticación ni permisos. Esta es la guía de cómo encajaría.

## Qué se reutiliza tal cual

- **InsForge Auth**: mismos usuarios (`auth.users`), mismo login email+contraseña (y OAuth si se activa).
- **Roles y RLS**: `app_users` + las políticas ya definidas. Un usuario `viewer` ve pero no edita,
  igual en web que en móvil. Para clientes finales (no staff) se añadiría un rol/políticas propias
  (ver "Para clientes" abajo).
- **RPCs** de escritura y `dashboard_stats`.

## Diferencia clave: tokens en móvil

En web el refresh va por cookie httpOnly. En móvil se usa el **flujo no-web**:

- Login con `?client_type=mobile` (o el helper equivalente del SDK) → devuelve **`refreshToken` en el
  cuerpo** (no cookie). El access token es de vida corta.
- **Guardar el refresh token en almacenamiento seguro del dispositivo**: iOS **Keychain**, Android
  **Keystore/EncryptedSharedPreferences**. Nunca en texto plano ni en logs.
- Refrescar con `POST /api/auth/refresh` enviando el `refreshToken`.

El SDK tiene documentación por lenguaje: `npx @insforge/cli docs auth swift` / `... kotlin` /
`... rest-api`.

## Arquitectura sugerida (móvil)

```
App móvil (Swift/Kotlin/React Native)
  · InsForge Auth (email+contraseña / OAuth)  → access token (memoria) + refresh token (Keychain/Keystore)
  · Lee InsForge con el JWT → RLS por rol
  · Escribe vía los mismos RPCs
```

Misma anon key pública (identifica el proyecto, no autoriza nada por sí sola). La autorización real
sigue siendo JWT + RLS.

## Para clientes finales (no staff) — cuando se quiera

Si la app móvil es para que el **cliente** vea SUS paquetes:

1. Agregar una relación cliente↔casillero (o cliente↔paquetes) y un rol `customer`.
2. Políticas RLS que filtren `packages` por el casillero/owner del usuario (no `is_staff()`), exponiendo
   solo campos seguros (sin datos de otros, sin internos). Conviene una **vista** o RPC que devuelva el
   payload mínimo (como hace hoy el Worker para `/track`).
3. Registro self-service con verificación de email (activar SMTP/redirect en InsForge `config`).

## Checklist de seguridad móvil

- [ ] Refresh token en Keychain/Keystore; access token solo en memoria.
- [ ] Forzar HTTPS; certificate pinning opcional.
- [ ] Cerrar sesión = borrar tokens del almacenamiento seguro + `signOut`.
- [ ] No registrar tokens ni PII en logs/analytics.
- [ ] Rol `customer` con RLS estricta (mínimo necesario), separado de staff.
- [ ] Expiración corta del access token + rotación del refresh token.
