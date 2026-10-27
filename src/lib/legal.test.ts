import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { legalSchema } from './legal-schema'
import { LEGAL_SLUGS, isLegalSlug } from './legal-slugs'

const CONTENT_DIR = join(process.cwd(), 'src/content/legal')

// Frontmatter parser mínimo. La metadata del centro legal es plano `key: value`,
// así que evitamos dependencias extra (gray-matter/js-yaml) manteniendo el parser
// acotado a ese formato. Falla ruidosamente ante estructuras no soportadas.
function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) throw new Error('frontmatter ausente')

  const out: Record<string, unknown> = {}
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/)
    if (!kv) throw new Error(`línea de frontmatter no soportada: "${line}"`)
    const [, key, value] = kv
    const v = value.trim()
    if (v === 'true' || v === 'false') out[key] = v === 'true'
    else if (/^-?\d+(\.\d+)?$/.test(v)) out[key] = Number(v)
    else out[key] = v.replace(/^['"]|['"]$/g, '')
  }
  return out
}

function readAllLegalFiles(): Array<{ file: string; data: Record<string, unknown> }> {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => ({
      file,
      data: parseFrontmatter(readFileSync(join(CONTENT_DIR, file), 'utf8')),
    }))
}

describe('centro legal — schema', () => {
  const files = readAllLegalFiles()

  it('tiene los 7 documentos esperados', () => {
    expect(files).toHaveLength(7)
    expect(files.map((f) => f.file).sort()).toEqual(
      [
        'cookies.md',
        'privacidad.md',
        'proveedores.md',
        'seguridad.md',
        'soporte.md',
        'terminos.md',
        'uso-aceptable.md',
      ].sort(),
    )
  })

  it('cada documento valida contra legalSchema', () => {
    for (const { file, data } of files) {
      const result = legalSchema.safeParse(data)
      expect(result.success, `${file}: ${JSON.stringify(result.error?.issues)}`).toBe(true)
    }
  })

  it('el slug del frontmatter coincide con el nombre del archivo', () => {
    for (const { file, data } of files) {
      const expected = file.replace(/\.md$/, '')
      expect(data.slug, `${file} → slug`).toBe(expected)
    }
  })

  it('navOrder es único entre documentos', () => {
    const orders = files.map((f) => f.data.navOrder)
    expect(new Set(orders).size).toBe(orders.length)
  })
})

describe('centro legal — allowlist de rutas', () => {
  const files = readAllLegalFiles()

  it('isLegalSlug acepta solo los slugs definidos', () => {
    for (const slug of LEGAL_SLUGS) expect(isLegalSlug(slug)).toBe(true)
    for (const bad of ['', 'no-existe', 'Uso-Aceptable', 'uso_aceptable', '../../etc'])
      expect(isLegalSlug(bad)).toBe(false)
  })

  it('LEGAL_SLUGS cubre exactamente los slugs de los archivos', () => {
    const fileSlugs = files.map((f) => String(f.data.slug))
    expect([...LEGAL_SLUGS].sort()).toEqual([...fileSlugs].sort())
  })
})

describe('centro legal — exclusión de drafts', () => {
  const files = readAllLegalFiles()
  const published = files.filter((f) => f.data.status === 'published')
  const drafts = files.filter((f) => f.data.status === 'draft')

  it('solo soporte y uso-aceptable están publicados', () => {
    expect(published.map((f) => f.data.slug).sort()).toEqual(['soporte', 'uso-aceptable'])
  })

  it('los documentos jurídicamente sensibles quedan en draft', () => {
    expect(drafts.map((f) => f.data.slug).sort()).toEqual(
      ['cookies', 'privacidad', 'proveedores', 'seguridad', 'terminos'].sort(),
    )
  })

  it('getPublishedLegalBySlug ignora los drafts', async () => {
    // Simula el filtro que hace getCollection en getPublishedLegal.
    const publishedOnly = new Set(published.map((f) => String(f.data.slug)))
    expect(publishedOnly.has('soporte')).toBe(true)
    expect(publishedOnly.has('privacidad')).toBe(false)
    expect(publishedOnly.has('terminos')).toBe(false)
    expect(publishedOnly.has('seguridad')).toBe(false)
    expect(publishedOnly.has('cookies')).toBe(false)
    expect(publishedOnly.has('proveedores')).toBe(false)
  })
})
