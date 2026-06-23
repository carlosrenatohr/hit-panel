# 08 · Seguridad

## Modelo

- **La anon key es pública** (va horneada en el bundle). No autoriza nada por sí sola: identifica el
  proyecto. La autorización real es **JWT del usuario + RLS**.
- **RLS default-deny**: sin políticas para `anon`; `authenticated` solo lee si `is_staff()`. Aunque
  alguien tenga la anon key, sin un JWT de un usuario en `app_users` activo **no ve nada**.
- **Escrituras solo por RPC** `SECURITY DEFINER` que validan `is_staff()`. El staff no tiene UPDATE/
  INSERT directos sobre las tablas → no puede tocar columnas no previstas.
- **Separación de superficies**: el sitio público usa el Worker (payload mínimo, sin PII). El panel
  (datos completos) exige login. InsForge nunca se expone a `anon` con datos.

## Llaves y secretos

| Secreto | Dónde | Exposición |
|---------|-------|-----------|
| Anon key | bundle del panel (`.env` → build) | pública (por diseño) |
| API key admin de InsForge | solo el Worker (`hit-ever2`) | **server-only**, nunca en el panel |
| JWT de usuario | memoria del navegador + cookie refresh | por sesión |
| Contraseña admin inicial | `ADMIN-CREDENTIALS.local.txt` (gitignored) | rotar al primer ingreso |

- Nunca poner la **API key admin** en el panel (es full-access, bypassa RLS).
- No commitear `.env`, `ADMIN-CREDENTIALS.local.txt`, ni `.insforge/project.json`.
- Rotar cualquier secreto que pase por chat/captura.

## Cuentas y acceso

- Cada persona = un usuario individual + rol. **Sin contraseña compartida.**
- Desactivar acceso = `app_users.active=false` (inmediato), sin borrar histórico.
- Verificación de email activa; a futuro, invitaciones self-service con SMTP.

## Sesión

- Access token de vida corta en memoria; refresh por cookie httpOnly + CSRF (web).
- `signOut` limpia la sesión. En móvil, borrar el refresh token del almacenamiento seguro.

## Pendientes recomendados (hardening)

- [ ] Rotar la contraseña del admin inicial (doc 04).
- [ ] Dominio propio alineado (panel + InsForge) para cookies de primera parte.
- [ ] Política de contraseñas / expiración de tokens revisada en InsForge `config`.
- [ ] **Audit log** de acciones de escritura (quién cambió qué) — ver roadmap.
- [ ] Revisar advisors de seguridad: `npx @insforge/cli diagnose advisor --category security`.
