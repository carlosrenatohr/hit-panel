# HIT Cargo — Panel interno (`hit-panel`)

Dashboard de operaciones del equipo HIT: ver/filtrar/buscar envíos (Everest + Global Connection),
detalle con historial y notas, **override manual de estado**, etiquetas/notas internas y **reportes**
con exportación CSV. Autenticación individual por usuario (InsForge Auth) con roles y RLS.

- **Producción**: https://hit-panel.pages.dev (Cloudflare Pages; requiere login)
- **Stack**: Astro 6 + Preact + Tailwind 3.4 + `@insforge/sdk`
- **Backend**: InsForge (`https://a4qvtp8s.us-east.insforge.app`) — comparte datos con el Worker `hit-ever2`

## Desarrollo

```bash
pnpm install
cp .env.example .env          # llenar PUBLIC_INSFORGE_URL y PUBLIC_INSFORGE_ANON_KEY
pnpm dev                      # localhost:4321
pnpm build && pnpm exec wrangler pages deploy dist --project-name hit-panel --branch main
```

La anon key: `npx @insforge/cli secrets get ANON_KEY` (en `hit-ever2/`, proyecto linkeado).

## Documentación

Todo en [`docs/`](docs/README.md), numerado para localizar rápido:
arquitectura · auth/roles · modelo+RLS · **acceso admin y alta de usuarios** · uso · despliegue ·
app móvil a futuro · seguridad · roadmap.

> Código y comentarios en inglés; copy de cara al usuario en español.
