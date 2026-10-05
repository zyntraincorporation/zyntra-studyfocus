import type { StudyMaterial } from '@/types/studyMaterials.types'

/** Split on commas (also newlines), trim, drop empties. */
export function parseLinks(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function padSeq(n: number): string {
  return String(n).padStart(2, '0')
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Next sequence number for a base title inside a chapter:
 * max(existing "{base} NN" numbers) + 1, so batches continue (04, 05...).
 */
export function nextSeqStart(baseTitle: string, existing: StudyMaterial[]): number {
  const re = new RegExp(`^${escapeRe(baseTitle.trim())}\\s+(\\d+)$`, 'i')
  let max = 0
  for (const m of existing) {
    const hit = m.title.trim().match(re)
    if (hit) max = Math.max(max, parseInt(hit[1], 10))
  }
  return max + 1
}

export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return `${String(h).padStart(2, '0')}:${mm}:${ss}`
}

export function sortMaterials(list: StudyMaterial[]): StudyMaterial[] {
  return [...list].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}
