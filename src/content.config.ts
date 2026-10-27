import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { legalSchema } from './lib/legal-schema'

// ─── Centro legal público ───────────────────────────────────────────────────
// Documentos estáticos en Markdown, generados en build. Sin CMS, sin base de
// datos nueva: Astro Content Collections + Zod validan la metadata en build y
// excluyen los drafts de rutas, navegación, sitemap y HTML.
//
// Regla editorial (ver AGENTS.md §Do Not): el contenido describe solo lo que el
// sistema realmente hace (hit-panel + hit-ever2). Nada de garantías, SLAs ni
// datos institucionales inventados. Los documentos con implicación jurídica
// nicaragüense arrancan como `draft` hasta revisión legal.
//
// El schema vive en `lib/legal-schema.ts` para reutilizarlo en los tests.
const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: legalSchema,
})

export const collections = { legal }
