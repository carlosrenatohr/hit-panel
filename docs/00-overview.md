# 00 · Visión general

## Qué es

El **Panel HIT Cargo** (`hit-panel`) es el dashboard interno del equipo para operar los envíos: ver
todos los paquetes (Everest + Global Connection), filtrarlos y buscarlos con detalle, revisar el
historial y las notas, **cambiar el estado manualmente**, agregar etiquetas/notas internas, y sacar
**reportes** con exportación a CSV. Es el gemelo **interno** del rastreador público `/track` (que es
mínimo y sin datos sensibles): el panel sí muestra todo (casillero, valor, referencia, remitente) a
usuarios autenticados del equipo.

## Quién lo usa

El equipo de HIT (Renato / Maya / Abi y a futuro más personas), cada uno con su **usuario individual**
y un **rol** (admin / staff / viewer). No hay contraseña compartida: cada quien entra con su cuenta.

## URLs y recursos

| Recurso | Dónde |
|---------|-------|
| Panel (producción) | `https://hit-panel.pages.dev` |
| Backend InsForge | `https://a4qvtp8s.us-east.insforge.app` (proyecto `8f6f1654-09f5-4ea8-8220-ed52ae464b58`) |
| Worker de ingesta | `hit-ever2` → `https://hit-ever-scraper.nativerse.workers.dev` |
| Repos | panel: `hit-panel` · API/ingesta: `hit-ever2` · sitio: `hit-cargo-web-v-1.2` |

> El dominio `*.honchkrow1995.workers.dev` está deprecado (no resuelve) — usar siempre `nativerse`.

## Stack

- **Astro 6 + Preact + Tailwind 3.4** (mismos tokens de marca que el sitio: primario `#FF7A00` — Naranja HIT, ver brand book del sitio).
- **@insforge/sdk** (auth + DB) hablando directo con InsForge usando el JWT del usuario.
- **Cloudflare Pages** (estático; sin servidor ni secretos en el borde).

## Cómo encaja con el resto

```
Worker hit-ever2 ──(scrape Everest/GC)──▶ InsForge (Postgres + Auth + RLS)
                                              ▲          ▲
   Panel (este proyecto) ──login JWT──────────┘          │ lee mínimo
                                                          │
   Sitio público /track ◀── Worker (admin key) ──────────┘
```

La ingesta de datos la hace el Worker (cron + email trigger). Ver `hit-ever2`.

**El panel sí llama algunos endpoints del Worker** (además de leer InsForge directo con el JWT del usuario):

- `src/lib/billing.ts` → `/api/billing/*` (facturación: catálogo, facturas, pagos, cierres, reportes, excepciones).
- `src/lib/customer.ts` → `/api/customer/*` (gestión de clientes).
- `src/lib/refresh.ts` → `/staff/packages/:guia/refresh` (re-scrape manual por guía).

Todas usan `PUBLIC_API_URL` (ver `.env.example`) como base, con fallback al dominio `nativerse` de producción. El Worker valida el JWT del usuario (delegando a InsForge) y resuelve su rol desde `app_users`.
