# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
