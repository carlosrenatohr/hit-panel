# HIT Cargo — Panel interno (`hit-panel`)

El dashboard operativo del equipo: todos los envíos de Everest y Global Connection en un solo lugar,
buscables por guía, tracking o casillero, con override manual de estado cuando el proveedor no lo
refleja bien, etiquetas y notas propias, y una sección de reportes con gráficos y exportación a
CSV/PDF para el cierre contable. Cada persona entra con su propio usuario — no hay contraseña
compartida, y los permisos (qué puede ver, qué puede editar) los decide la base de datos, no el
código del cliente.

- **Producción:** https://hit-panel.pages.dev (requiere login)
- **Stack:** Astro 6 + Preact + Tailwind, `@insforge/sdk` para auth y datos, Chart.js para los reportes
- **Backend:** InsForge — el mismo proyecto que llena el Worker `hit-ever2`; el panel lee directo con
  el JWT del usuario y RLS decide qué filas puede ver cada rol

## Cómo funciona por dentro

No hay backend propio para este panel. Es un sitio estático (Cloudflare Pages) que habla con
InsForge directamente: el login devuelve un JWT, las consultas van con ese JWT, y las políticas de
Row Level Security en la base deciden qué tablas y filas puede tocar cada rol (`admin`, `staff`,
`viewer`). Las escrituras (cambiar un estado, agregar una nota) pasan por funciones `SECURITY
DEFINER` en Postgres en vez de un `UPDATE` directo, así el cliente nunca tiene más poder del que
debería. El Worker sigue siendo el único que scrapea Cargotrack y el único con la API key admin —
el panel nunca la toca.

## Arrancar en local

```bash
pnpm install
cp .env.example .env          # PUBLIC_INSFORGE_URL y PUBLIC_INSFORGE_ANON_KEY
pnpm dev                      # localhost:4321
```

La anon key se saca del proyecto InsForge ya linkeado en `hit-ever2/`:

```bash
cd ../hit-ever2 && npx @insforge/cli secrets get ANON_KEY
```

## Deploy

```bash
pnpm build
pnpm exec wrangler pages deploy dist --project-name hit-panel --branch main
```

Como el panel es estático, la URL y la anon key quedan compiladas en el bundle — si cambian, hay que
reconstruir antes de redeployar, no basta con actualizar `.env`.

## Documentación

Todo el detalle vive en [`docs/`](docs/README.md), numerado para no andar buscando:
arquitectura, auth y roles, el modelo de datos con sus políticas RLS, **cómo dar acceso a alguien
nuevo**, guía de uso de cada sección, despliegue, la app móvil que viene más adelante, seguridad y
el roadmap. Si necesitás dar de alta a una persona del equipo, el doc 04 tiene el procedimiento
completo.

---

*Código y comentarios en inglés; el copy de cara al usuario, en español.*
