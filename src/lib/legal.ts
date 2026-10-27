import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'

// Re-export del allowlist puro (vive en legal-slugs.ts para poder testearlo sin
// resolver el módulo virtual `astro:content`).
export { LEGAL_SLUGS, isLegalSlug } from './legal-slugs'
export type { LegalSlug } from './legal-slugs'

export type LegalEntry = CollectionEntry<'legal'>

// Documentos PUBLICADOS, ordenados por navOrder. Los drafts quedan fuera de rutas,
// navegación, sitemap y HTML (regla editorial del centro legal).
export async function getPublishedLegal(): Promise<LegalEntry[]> {
  const all = await getCollection('legal', ({ data }) => data.status === 'published')
  return all.sort((a, b) => a.data.navOrder - b.data.navOrder)
}

// Documento publicado por slug, o undefined si es draft/inexistente.
export async function getPublishedLegalBySlug(slug: string): Promise<LegalEntry | undefined> {
  const published = await getPublishedLegal()
  return published.find((entry) => entry.data.slug === slug)
}
