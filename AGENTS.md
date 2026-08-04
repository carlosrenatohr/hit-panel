# AGENTS.md — Hit Cargo Panel

This sub-repo (`hit-panel`) is one of five in the workspace. The canonical AGENTS.md lives at the workspace root (`/hit/AGENTS.md`) and covers cross-repo architecture, coding standards, CI/deploy, security, and agent workflow.

## Codebase Memory (knowledge graph)

This project is indexed in Codebase Memory. **Preferir MCP tools sobre grep/glob/read:**

1. `search_graph` — encontrar funciones/clases/routes/variables por patrón
2. `trace_path` — ver quién llama una función antes de tocarla (impact analysis)
3. `get_code_snippet` — leer código de un símbolo exacto (no archivos enteros)
4. `detect_changes` — antes de refactor, cuantificar blast radius

**Nunca leer un archivo entero si no es el que estás editando.** Para strings literales usar grep con `include` filter.

This file only adds repo-specific context for working on the panel.