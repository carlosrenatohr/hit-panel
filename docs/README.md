# HIT Cargo — Panel interno · Documentación

Índice numerado de la documentación del panel administrativo (dashboard de operaciones).
Lee en orden o salta al número que necesites.

| # | Documento | Para qué |
|---|-----------|----------|
| 00 | [Visión general](00-overview.md) | Qué es el panel, quién lo usa, URLs y stack |
| 01 | [Arquitectura](01-architecture.md) | Componentes, flujo de datos, decisiones, escalabilidad |
| 02 | [Autenticación y roles](02-auth-and-roles.md) | InsForge Auth, JWT, roles admin/staff/viewer |
| 03 | [Modelo de datos y RLS](03-data-model-and-rls.md) | Tablas, `effective_status`, políticas RLS, RPCs, migraciones |
| 04 | [Acceso admin y gestión de usuarios](04-admin-access-and-user-management.md) | **Cómo entrar la primera vez y cómo crear/quitar usuarios** |
| 05 | [Funcionalidades y uso](05-features-and-usage.md) | Resumen, envíos, filtros, detalle, acciones, reportes, CSV |
| 06 | [Despliegue y operación](06-deployment-and-ops.md) | Build, deploy a Cloudflare Pages, env, dominio, rollback |
| 07 | [App móvil a futuro](07-mobile-app-future.md) | Reusar el mismo Auth con auth individual segura |
| 08 | [Seguridad](08-security.md) | Modelo de amenazas, RLS, llaves, PII, rotación |
| 09 | [Roadmap y escalado](09-roadmap-and-scaling.md) | Qué sigue y cómo crece sin reescribir |

**Resumen ultra-rápido**
- Panel: `https://hit-panel.pages.dev` (estático en Cloudflare Pages; requiere login).
- Backend: InsForge (`https://a4qvtp8s.us-east.insforge.app`, proyecto `8f6f1654…`).
- Auth: InsForge Auth (email + contraseña) → JWT → RLS por rol. El mismo backend servirá la futura app móvil.
- Datos: los mismos que llena el Worker `hit-ever2` (Everest + Global Connection). El panel **lee** con el JWT del usuario y **escribe** vía RPCs `SECURITY DEFINER`.

> Código en inglés; copy de cara al usuario en español. Esta documentación es operativa/interna.
