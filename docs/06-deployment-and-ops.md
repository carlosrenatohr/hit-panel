# 06 · Despliegue y operación

## Variables de entorno (build-time)

El panel es estático: las variables se **hornean** en el bundle al compilar. Son **públicas** (la anon
key es segura en el cliente; la seguridad real es RLS + JWT).

`.env` (gitignored; ver `.env.example`):

```bash
PUBLIC_INSFORGE_URL=https://a4qvtp8s.us-east.insforge.app
PUBLIC_INSFORGE_ANON_KEY=<anon key — npx @insforge/cli secrets get ANON_KEY>
PUBLIC_API_URL=https://hit-ever-scraper.nativerse.workers.dev
```

`PUBLIC_API_URL` es la base del Worker para `/api/billing/*`, `/api/customer/*` y el refresh manual
(`/staff/packages/:guia/refresh`). El bundle ya tiene el fallback al dominio `nativerse`, pero si apuntás
a otro ambiente (dev/preview), setealas antes de compilar.

## Build local

```bash
cd hit-panel
pnpm install
pnpm build        # genera dist/
pnpm dev          # desarrollo en localhost:4321
```

## Deploy a Cloudflare Pages

Proyecto: **`hit-panel`** → `https://hit-panel.pages.dev`.

```bash
pnpm build
pnpm exec wrangler pages deploy dist --project-name hit-panel --branch main
```

Cada deploy imprime una URL única de preview (`https://<hash>.hit-panel.pages.dev`) y actualiza el alias
de producción `hit-panel.pages.dev`. Como el `.env` se hornea, **reconstruye** (`pnpm build`) si cambian
la URL o la anon key (p. ej. tras rotarla) antes de redeployar.

> Opcional: conectar el repo de GitHub a Pages para auto-build en cada push (Settings → Builds), con
> las `PUBLIC_*` configuradas como variables de build en Pages.

## Dominio propio (recomendado a futuro)

Hoy: `hit-panel.pages.dev`. Para `panel.hit-cargo.com`:
1. Mover el DNS de `hit-cargo.com` a Cloudflare (ver `hit-ever2/docs/production-deployment.md` §3).
2. Pages → hit-panel → Custom domains → agregar `panel.hit-cargo.com`.

**Bonus de alinear dominios**: si el panel vive en `panel.hit-cargo.com` y InsForge en un subdominio
propio (`*.hit-cargo.com`), la cookie de refresh deja de ser de terceros y la sesión persiste limpio en
todos los navegadores (ver la nota cross-domain en doc 02).

## Rollback

- Pages → hit-panel → Deployments → elegir un deploy anterior → "Rollback".
- O redeployar un build previo.

## Notas de runtime conocidas

- **`crypto` externalizado**: al compilar, Vite avisa que externaliza el builtin `crypto` que importa
  `@insforge/sdk`. El login por contraseña y las lecturas/RPCs no dependen de él en el navegador. Si en
  algún flujo apareciera un error de `crypto` indefinido, se resuelve con un shim/polyfill en
  `astro.config.mjs` (`vite.resolve.alias` o `define`). Verificar el login real en navegador tras deploy.
- **Sesión cross-domain**: ver doc 02 — en `*.pages.dev` una recarga dura puede pedir login otra vez en
  navegadores que bloquean cookies de terceros. Se elimina con dominio propio alineado.

## Monitoreo

- Datos/estado de ingesta: el propio Resumen del panel (salud por proveedor).
- Errores de backend: `npx @insforge/cli diagnose logs` / `logs postgrest.logs` (ver skill insforge-cli).
- Worker (ingesta): Cloudflare Observability del Worker `hit-ever-scraper`.
