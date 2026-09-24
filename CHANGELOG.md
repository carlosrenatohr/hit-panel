# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.7] — 2026-09-24

### Changed
- The tracking number shows without the redundant \`Tracking \` prefix in the invoice detail and the print template (matches the WhatsApp PDF).

## [0.4.6] — 2026-09-24

### Changed
- Package buttons now pop: \`Ver en GC\` and \`Track\` use the palette primary orange (same solid style as the app's Button), and \`Rastrear en Parcel\` uses Parcel's own gradient (\`to left, #2980b9, #2EB187\`).

## [0.4.5] — 2026-09-23

### Changed
- The invoice secondary line shows only the symbol+amount (\`C\$3,700.00\`) — no \`≈\`, no exchange rate.

## [0.4.4] — 2026-09-23

### Fixed
- The WhatsApp invoice link now carries a fresh \`?ts=\` cache-buster, so every share downloads a new PDF (no stale browser/WhatsApp copy) — the worker also sends \`Cache-Control: no-store\`.

## [0.4.3] — 2026-09-23

### Changed
- The invoice secondary line shows only the equivalent in the other currency (`≈ C$3,700.00`), without the exchange rate — on the printed invoice and the detail view.

## [0.4.2] — 2026-09-23

### Changed
- The WhatsApp invoice link now points to the new on-the-fly PDF endpoint (`/billing/r/:token/pdf`) so the recipient downloads the invoice as a PDF directly. The HTML preview link (share button / print) is unchanged.

## [0.4.1] — 2026-09-23

### Fixed
- Dates keep the exact calendar day everywhere: bare `YYYY-MM-DD` (HTML date inputs, invoice `issue_date`) is parsed as local midnight instead of UTC midnight, which fell a day behind in UTC− zones. `toLocalDate()` reused by `fmtDate` / `daysAgo` / invoice days badges.

### Added
- Client autocomplete searches from the first character; the "create client" option opens at 1 char too (Original Express flow).
- Invoice total is prominent in the working currency with a small secondary line for the other currency at the agency's exchange rate (USD ↔ córdobas), on the printed invoice, the detail view and the public receipt.
- "Enviar por WhatsApp" in the invoice detail: opens a `wa.me` deep link with a friendly message and the public receipt URL — targets the client's phone, falling back to the agency owner's number, normalized to digits (+505 for NI mobiles). Nothing new is generated or hosted.

## [0.2.1] — 2026-07-10

### Changed
- Login screen now shows the full HIT Cargo logo (web-optimized transparent asset) instead of the
  mark + text lockup.

## [0.2.0] — 2026-07-10

First tagged release of the HIT Cargo **internal team panel** — a private dashboard (Astro 6 +
Preact + InsForge) for the team to view, filter, correct and report on every shipment ingested by
the `hit-ever2` worker. It reads and writes InsForge directly with the signed-in user's JWT; RLS
decides what each role can see. It does not scrape Cargotrack or hold the worker's admin key.

### Added
- **Shipments dashboard.** Paginated list of all packages with per-row status, service, cargo and
  timing.
- **Search** by waybill (guía), carrier tracking number, recipient name and mailbox (casillero).
- **Filters** by provider, effective status, service (air/ocean) and received-date range (preset
  date-range picker).
- **Numeric pagination** (first/last + windowed page numbers) that stays compact as volume grows.
- **"Ready for pickup" default sort** — surfaces packages that have arrived in Nicaragua
  (`en_destino`) first and sinks delivered ones to the bottom, oldest Miami reception first as the
  tiebreaker (backed by a `status_rank` column in the worker's schema).
- **Miami reception date + days-in-pipeline counter** for packages not yet delivered, disambiguated
  from the "days since last event" staleness badge.
- **Configurable columns** — show/hide and drag-to-reorder, persisted per browser.
- **CSV export** of the current filtered view.
- **Shipment detail** drawer: 4-step pipeline, event history, provider notes, internal tags/notes,
  manual status override, recipient name + hazmat badge + origin flag, package photo modal, and
  deep links to the provider's own page and to Parcel by tracking number.
- **Reports** view: charts (status distribution, provider × status, service split, monthly intake),
  a summary table, PDF export and the same date-range/filter controls.
- **Mobile-responsive layout** — the shipments table collapses to cards on small screens; filters
  pack two-up; the detail drawer and modals are touch-friendly.
- **Staff auth** via InsForge (email/password), role-gated (`admin` / `staff`) through RLS.

### Notes
- Roadmap item documented but not built: an admin/superadmin "refresh now" button that proxies the
  worker's force-refresh endpoint through an InsForge Edge Function (the worker's admin secret must
  never reach the browser). See `docs/09-roadmap-and-scaling.md`.
