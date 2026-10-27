// Pages Function — expone la lógica pura de `src/lib/contact.ts` en POST /api/contact.
// `wrangler pages deploy dist` (desde la raíz del repo) empaqueta este `functions/`.
//
// Requiere en el proyecto de Cloudflare Pages:
//  1. Binding `send_email` (Email Sending) → `env.EMAIL`
//  2. Var `CONTACT_FROM` = remitente en un dominio habilitado
// Ver README/docs de despliegue. Sin ellos responde 503 (no finge éxito).
import { handleContactRequest } from '../../src/lib/contact'

// Contexto mínimo que usa este handler (evita requerir @cloudflare/workers-types
// en el chequeo de tipos del panel).
interface PagesContext {
  request: Request
  env: Record<string, unknown>
}

// `onRequest` (todos los métodos) para que un GET/PUT responda 405 desde el
// handler en vez de caer al fallback estático del SPA.
export function onRequest(context: PagesContext): Promise<Response> {
  return handleContactRequest(context.request, context.env as never)
}
