# CLAUDE.md — Hit Cargo Panel

This sub-repo (`hit-panel`) is one of five in the workspace. The canonical AGENTS.md lives at the workspace root (`/hit/AGENTS.md`) and covers cross-repo architecture, coding standards, CI/deploy, security, and agent workflow.

This file only adds repo-specific context for working on the panel.

## Key standards (mirror of workspace AGENTS.md)

- **Agent workflow:** use Codebase Memory (`search_graph`, `trace_path`) before `grep`/`read`; `read` only the file you edit; verify with `pnpm check` (astro typecheck); never merge without green gate + 1 review.
- **Astro 6 + Preact**; 100% client-only (`client:only`); serves as static site on Cloudflare Pages.
- **No backend propio.** Reads/writes go through InsForge direct:
  - **Lectura:** `@insforge/sdk` con el JWT del usuario (RLS decide).
  - **Escritura:** **siempre y obligatoriamente por RPC** `SECURITY DEFINER` — `set_manual_status`, `add_package_tag`, `add_package_note`, `dashboard_stats`. Nunca `UPDATE`/`INSERT` directo.
- **Env vars** (`PUBLIC_*`) se hornean en el bundle → rebuild + redeploy si cambian.
- **Anon key** es pública (identifica el proyecto, no autoriza). Autorización real = **JWT del usuario + RLS**.

### Local dev
```bash
pnpm install
cp .env.example .env    # PUBLIC_INSFORGE_URL + PUBLIC_INSFORGE_ANON_KEY
pnpm dev                # localhost:4321
pnpm check              # astro typecheck (current gate)
```
