import { z } from 'astro/zod'

// Schema del centro legal, extraído a un módulo propio para poder importarlo tanto
// desde `src/content.config.ts` como desde los tests de Vitest (que no resuelven
// el módulo virtual `astro:content`). Misma definición, una sola fuente.
export const legalSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  // Ruta pública amigable sin barra inicial (ej. `uso-aceptable` → /uso-aceptable).
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug debe ser kebab-case (ej. `uso-aceptable`)'),
  updatedAt: z.coerce.date(),
  status: z.enum(['draft', 'published']).default('draft'),
  // Orden de aparición en la navegación/legal nav.
  navOrder: z.number().int().positive(),
  version: z.string().optional(),
})

export type LegalData = z.infer<typeof legalSchema>
