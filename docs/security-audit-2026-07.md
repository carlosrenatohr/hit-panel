# Security & correctness audit — hit-panel (julio 2026)

Auditoría del panel interno. **Arquitectura sólida:** solo la anon key en el cliente (verificado
`role:anon`), RLS default-deny en todas las tablas de ops, escrituras solo vía RPCs `SECURITY DEFINER`,
sin sinks de XSS, secretos no trackeados, tokens no en localStorage. La frontera real es RLS (el browser
habla directo con InsForge). Un hueco de autorización real (viewer podía escribir) + fixes de correctness.

## Arreglado en esta PR

| # | Sev | Qué | Fix |
|---|-----|-----|-----|
| — | — | 6 errores de tipo de `astro check` (Button/IconButton no aceptaban `type`/`disabled`; cast de la lista). | `JSX.ButtonHTMLAttributes` + cast por `unknown`. **`astro check` ahora 0 errores.** |
| CSV | MED | Formula-injection en exports: `esc()` no neutralizaba celdas que empiezan con `= + - @` tab/CR. Texto scrapeado de Cargotrack (nombres, oficinas) llega al CSV → fórmula ejecutable en Excel/Sheets. | Prefijo `'` a celdas de riesgo antes de citar. |
| Fecha | MED | Rango "hasta" usaba `lte('received_at', fecha)` contra medianoche → descartaba todo lo recibido ese día (los envíos de hoy desaparecían de listas/reportes/exports). | `< día siguiente` (incluye el día completo). |
| Logout | LOW | `logout()` no limpiaba estado si `signOut()` fallaba → UI quedaba "logueada". | `finally` limpia estado siempre. |

Gate: `astro check` 0 errores / 0 warnings; `astro build` verde.

## Acción requerida (documentado, no en esta PR)

- **[HIGH] Rol `viewer` podía escribir** — el fix vive en **hit-ever2** (los RPCs están allá): PR de migración `fix-viewer-write-rls` agrega `is_writer()` y re-guarda `set_manual_status`/`add_package_tag`/`add_package_note`. **Aplicar la migración** (`npx @insforge/cli db migrations up --all`) para cerrar el hueco; hasta entonces un viewer puede escribir vía consola aunque la UI oculte los botones.
- **[MED] Reportes truncan a 5000 filas sin aviso** (`Reports.tsx` `EXPORT_CAP`): los KPIs/charts/totales se calculan sobre `rows.length` capado → subconteo silencioso en rangos grandes (mal para contabilidad). Además diverge del "Total" de Overview (que usa `dashboard_stats`, exacto). **Fix recomendado:** mover las agregaciones a un RPC server-side (extender `dashboard_stats` con filtros), o al menos mostrar "mostrando N de M" y usar el header `count` para el Total. El CSV de Shipments (cap 2000) tiene el mismo riesgo.
- **[LOW] `ADMIN-CREDENTIALS.local.txt`** (root, gitignored, no trackeado) tiene la contraseña admin inicial en texto plano. Confirmá que se rotó tras el primer login y borralo cuando haya usuarios reales.
- **Verificar en InsForge Auth:** que el self-signup público esté deshabilitado (defensa en profundidad; un JWT `authenticated` sin fila en `app_users` no lee/escribe nada, pero conviene bloquearlo).

## Verificado como correcto

- Anon key en cliente (no admin/service key); admin key solo en el Worker.
- RLS habilitada default-deny en `packages/events/providers/package_tags/package_notes/package_provider_notes`; escrituras solo por RPCs (staff no toca columnas fuera de las permitidas); `app_users` sin self-escalation.
- Sin XSS: cero `set:html`/`innerHTML`/`dangerouslySetInnerHTML`; todo el texto de la DB renderiza como children JSX (auto-escapado); links externos con `rel="noopener noreferrer"`.
- Tokens: access en memoria, refresh por cookie httpOnly del SDK; `localStorage` solo para prefs de columnas. `currentUser()` revalida `active` en cada carga.
- Search sanitiza `(),*` antes del `.or()` de PostgREST; acceso real por login gate + RLS (no solo `noindex`).
