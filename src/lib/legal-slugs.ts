// Constantes puras del centro legal — sin imports de Astro, para que los tests de
// Vitest puedan importarlas sin resolver el módulo virtual `astro:content`.

// Slug allowlist — única fuente de verdad de las rutas públicas del centro legal.
// `[slug].astro` la usa en getStaticPaths; el test de rutas la valida contra el
// contenido real para que nunca quede una ruta huérfana ni un documento sin publicar.
export const LEGAL_SLUGS = [
  'privacidad',
  'terminos',
  'seguridad',
  'cookies',
  'proveedores',
  'uso-aceptable',
  'soporte',
] as const

export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value)
}
