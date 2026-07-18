# Graph Report - .  (2026-07-17)

## Corpus Check
- Corpus is ~49,701 words - fits in a single context window. You may not need a graph.

## Summary
- 332 nodes · 678 edges · 18 communities
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.82)
- Token cost: 181,322 input · 0 output

## Community Hubs (Navigation)
- Billing UI (facturación)
- Shipments & reports UI
- App shell, InsForge client & UI primitives
- Package config & dependencies
- UI screenshots (panel views)
- Security audit & export correctness
- Panel architecture & hosting
- TypeScript config
- Manual status & write RPCs
- Date range picker
- Auth, RLS & backend model
- Worker/ingestion integration & roadmap
- Roles & public/private surface
- Brand logo assets
- Tags/notes RPCs & staff helpers

## God Nodes (most connected - your core abstractions)
1. `../components/App.tsx` - 17 edges
2. `ShipmentDetail()` - 12 edges
3. `Shipments()` - 12 edges
4. `Spinner()` - 12 edges
5. `fmtDate()` - 12 edges
6. `Button()` - 11 edges
7. `fmtUsd()` - 11 edges
8. `Card()` - 10 edges
9. `providerLabel()` - 10 edges
10. `SectionTitle()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `status_rank column (ready-for-pickup sort)` --semantically_similar_to--> `effective_status generated column`  [INFERRED] [semantically similar]
  CHANGELOG.md → docs/03-data-model-and-rls.md
- `Filter bar (search, provider, status, service, ready-for-pickup, date range)` --semantically_similar_to--> `Reports filter bar (search, provider, status, service, date range)`  [INFERRED] [semantically similar]
  dashboard.png → reports.png
- `Pipeline progress bar (Bodega Miami, En transito, Nicaragua, Entregado)` --semantically_similar_to--> `Status distribution donut chart (Distribucion por estado)`  [INFERRED] [semantically similar]
  detail.png → reports.png
- `Cloudflare Pages deploy workflow (GitHub Actions)` --implements--> `Cloudflare Pages (static hosting)`  [INFERRED]
  .github/workflows/deploy.yml → docs/00-overview.md
- `Cloudflare Pages deploy workflow (GitHub Actions)` --references--> `HIT Cargo internal panel (hit-panel)`  [INFERRED]
  .github/workflows/deploy.yml → docs/00-overview.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SECURITY DEFINER write RPCs (staff-gated)** — docs_03_data_model_and_rls_set_manual_status_rpc, docs_03_data_model_and_rls_add_package_tag_rpc, docs_03_data_model_and_rls_add_package_note_rpc [INFERRED 0.85]
- **Authorization model: JWT + RLS + app_users roles** — docs_08_security_jwt_rls_authorization, docs_01_architecture_rls, docs_02_auth_and_roles_app_users [INFERRED 0.75]
- **July 2026 audit correctness fixes** — docs_security_audit_2026_07_csv_formula_injection_fix, docs_security_audit_2026_07_date_range_fix, docs_security_audit_2026_07_logout_finally_fix [INFERRED 0.85]
- **HIT Cargo brand asset set** — public_logo_full_dark_full_logo_dark, public_logo_full_full_logo, public_logo_mark_isotype_mark, public_logo_logo_jpg, public_mark_180_apple_touch_icon, public_mark_32_favicon, public_mark_512_icon [INFERRED 0.75]

## Communities (18 total, 0 thin omitted)

### Community 0 - "Billing UI (facturación)"
Cohesion: 0.06
Nodes (57): diffDays(), InvoiceDaysBadge(), BillingReports(), monthRange(), MONTHS, Facturacion(), pageWindow(), Tab (+49 more)

### Community 1 - "Shipments & reports UI"
Cohesion: 0.09
Nodes (48): BASE_FONT, Reports(), ymd(), ColState, COLUMN_DEFS, ColumnPicker(), DEFAULT_HIDDEN, defaultColumns() (+40 more)

### Community 2 - "App shell, InsForge client & UI primitives"
Cohesion: 0.08
Nodes (35): ../styles/global.css, ../components/App.tsx, App(), View, hoursAgo(), Overview(), NAV, ColumnDef (+27 more)

### Community 3 - "Package config & dependencies"
Cohesion: 0.06
Nodes (32): astro, @astrojs/check, @astrojs/preact, @astrojs/tailwind, chart.js, @insforge/sdk, lucide-preact, dependencies (+24 more)

### Community 4 - "UI screenshots (panel views)"
Cohesion: 0.10
Nodes (21): Filter bar (search, provider, status, service, ready-for-pickup, date range), Shipments dashboard view (Envios), Shipments table (guia, nombre, tracking, proveedor, estado, servicio, carga, recibido Miami), Sidebar navigation (Resumen, Envios, Reportes, Facturacion), Status pill (Entregado), Toolbar actions (Columnas, Calendario, Exportar CSV), Event history timeline (Historial de eventos), External tracking links (Ver en Global Connection, Rastrear en Parcel) (+13 more)

### Community 5 - "Security audit & export correctness"
Cohesion: 0.18
Nodes (13): status_rank column (ready-for-pickup sort), dashboard_stats RPC, CSV export (respects filters), Overview KPIs + ingest health traffic-light, Reports view (status x provider, service, monthly), Shipments table (search/filter/paginate), Stale indicator (>10 days no event), Security & correctness audit (July 2026) (+5 more)

### Community 6 - "Panel architecture & hosting"
Cohesion: 0.20
Nodes (12): Cloudflare Pages (static hosting), HIT Cargo internal panel (hit-panel), @insforge/sdk (auth + DB), Astro 6 + Preact + Tailwind stack, Design: 100% client-side static (client:only) on Cloudflare Pages, Cross-domain refresh cookie limitation, Build-time PUBLIC_* env baked into bundle, crypto builtin externalized (Vite note) (+4 more)

### Community 7 - "TypeScript config"
Cohesion: 0.17
Nodes (11): **/*, astro/tsconfigs/strict, .astro/types.d.ts, dist, compilerOptions, jsx, jsxImportSource, verbatimModuleSyntax (+3 more)

### Community 8 - "Manual status & write RPCs"
Cohesion: 0.22
Nodes (11): Design: writes via SECURITY DEFINER RPCs, not direct UPDATE/INSERT, effective_status generated column, events table (per-package history), package_provider_notes table (from Cargotrack), packages table, providers table (everest, global_connection), set_manual_status RPC, shipment_status enum (+3 more)

### Community 9 - "Date range picker"
Cohesion: 0.24
Nodes (5): DateRangePicker(), fmtShort(), matchPreset(), Preset, PRESETS

### Community 10 - "Auth, RLS & backend model"
Cohesion: 0.31
Nodes (10): InsForge backend (Postgres + Auth + RLS), Design: InsForge-direct + RLS, no own backend, Row Level Security (RLS), app_users table (user to role), InsForge Auth (email+password to JWT), User creation procedure (Auth account + app_users row), Future mobile app (reuses same backend), Mobile secure token storage (Keychain/Keystore) (+2 more)

### Community 11 - "Worker/ingestion integration & roadmap"
Cohesion: 0.32
Nodes (8): hit-ever2 ingestion Worker, Cargotrack (Everest + Global Connection), Panel migrations (dashboard-auth, effective-status) in hit-ever2, InsForge admin API key (server-only, Worker only), Worker ADMIN_SECRET (shared secret), InsForge Edge Function proxy for ADMIN_SECRET, Per-guia refresh cooldown/rate-limit, 'Refresh now' button (roadmap)

### Community 12 - "Roles & public/private surface"
Cohesion: 0.29
Nodes (7): Public /track tracker (minimal, no PII), current_staff_role() SQL helper, staff_role enum (admin/staff/viewer), Seed admin user (admin@hit-cargo.com), Future customer role + per-mailbox RLS, Public/private surface separation, Viewer-could-write RLS hole (is_writer fix in hit-ever2)

### Community 13 - "Brand logo assets"
Cohesion: 0.29
Nodes (7): HIT Cargo full logo (dark/light-on-dark variant, white wordmark), HIT Cargo full logo (globe-arrow mark + black HIT CARGO wordmark), HIT Cargo full logo (JPEG, mark + HIT CARGO wordmark on white), HIT Cargo isotype mark (orange globe with upward arrow), HIT Cargo isotype mark 180px (apple-touch icon), HIT Cargo favicon 32px (isotype mark), HIT Cargo isotype mark 512px (PWA/app icon)

### Community 14 - "Tags/notes RPCs & staff helpers"
Cohesion: 0.50
Nodes (5): is_admin() SQL helper, is_staff() SQL helper, add_package_note RPC, add_package_tag RPC, package_tags / package_notes (internal)

## Knowledge Gaps
- **84 isolated node(s):** `name`, `type`, `version`, `private`, `description` (+79 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `../components/App.tsx` connect `App shell, InsForge client & UI primitives` to `Billing UI (facturación)`, `Shipments & reports UI`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `HIT Cargo internal panel (hit-panel)` connect `Panel architecture & hosting` to `Auth, RLS & backend model`, `Roles & public/private surface`, `Security audit & export correctness`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `Security & correctness audit (July 2026)` connect `Security audit & export correctness` to `Roles & public/private surface`, `Panel architecture & hosting`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `type`, `version` to the rest of the system?**
  _84 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Billing UI (facturación)` be split into smaller, more focused modules?**
  _Cohesion score 0.056338028169014086 - nodes in this community are weakly interconnected._
- **Should `Shipments & reports UI` be split into smaller, more focused modules?**
  _Cohesion score 0.08757062146892655 - nodes in this community are weakly interconnected._
- **Should `App shell, InsForge client & UI primitives` be split into smaller, more focused modules?**
  _Cohesion score 0.07922705314009662 - nodes in this community are weakly interconnected._