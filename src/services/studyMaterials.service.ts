/**
 * Standalone Study Materials data layer.
 *   users/{uid}/studyMaterials/{id}
 *   users/{uid}/studyMaterialProgress/{resourceId}
 *   users/{uid}/studyMaterialDaily/{YYYY-MM-DD}_{subjectId}
 * All covered by the existing users/{uid}/{subcollection}/{docId} rule.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { db } from './firebase'
import { USERS_COL, SUB } from '@/constants/firebase'
import type {
  StudyMaterial,
  StudyMaterialProgress,
  StudyMaterialDailyTime,
} from '@/types/studyMaterials.types'
import type { Chapter } from '@/types/curriculum.types'
import { padSeq, parseLinks, sortMaterials } from '@/utils/studyMaterials.utils'

const matsCol = (uid: string) => collection(db, USERS_COL, uid, SUB.STUDY_MATERIALS)
const progressDoc = (uid: string, rid: string) =>
  doc(db, USERS_COL, uid, SUB.STUDY_MATERIAL_PROGRESS, rid)
const dailyCol = (uid: string) => collection(db, USERS_COL, uid, SUB.STUDY_MATERIAL_DAILY)

export async function getAllStudyMaterials(uid: string): Promise<StudyMaterial[]> {
  const snap = await getDocs(matsCol(uid))
  return sortMaterials(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudyMaterial))
}

/** All active chapters across subjects (single-field read, no composite index). */
export async function getAllChapters(uid: string): Promise<Chapter[]> {
  const snap = await getDocs(collection(db, USERS_COL, uid, SUB.CHAPTERS))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Chapter)
    .filter((c) => c.isActive !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export interface BulkAddResult {
  created: string[]
  skipped: number
}

/** order = groupIndex * ORDER_GROUP + seq  → explicit, serial-driven ordering */
export const ORDER_GROUP = 100000

/**
 * Bulk-add Drive links to a chapter.
 * - Numbering starts at `startSerial` (default 1), zero-padded.
 * - Throws if any generated title already exists in the chapter (no duplicate serials).
 * - `order` is derived from the serial (not creation time); different base titles
 *   in one chapter form separate ordered groups.
 */
export async function bulkAddStudyMaterials(
  uid: string,
  subjectId: string,
  chapterId: string,
  baseTitle: string,
  rawLinks: string,
  startSerial = 1
): Promise<BulkAddResult> {
  const title = baseTitle.trim()
  const links = parseLinks(rawLinks)
  if (!title || links.length === 0) return { created: [], skipped: 0 }
  if (!Number.isInteger(startSerial) || startSerial < 1) {
    throw new Error('Starting serial must be a positive whole number.')
  }

  const all = await getAllStudyMaterials(uid)
  const inChapter = all.filter((m) => m.chapterId === chapterId)
  const existingUrls = new Set(inChapter.map((m) => m.googleDriveUrl))

  // Skip links already in this chapter and repeats within the batch
  const seen = new Set<string>()
  const fresh = links.filter((l) => {
    if (existingUrls.has(l) || seen.has(l)) return false
    seen.add(l)
    return true
  })

  const names = fresh.map((_, i) => `${title} ${padSeq(startSerial + i)}`)
  const taken = new Set(inChapter.map((m) => m.title.trim().toLowerCase()))
  const clash = names.filter((n) => taken.has(n.toLowerCase()))
  if (clash.length > 0) {
    throw new Error(
      `Serial already used: ${clash.slice(0, 3).join(', ')}${clash.length > 3 ? '…' : ''}. Pick a different starting serial.`
    )
  }

  // Group index for this base title within the chapter
  const sameBase = inChapter.find((m) => m.baseTitle?.toLowerCase() === title.toLowerCase())
  const groupIndex = sameBase
    ? Math.floor(sameBase.order / ORDER_GROUP)
    : inChapter.reduce((mx, m) => Math.max(mx, Math.floor(m.order / ORDER_GROUP)), -1) + 1

  const created: string[] = []
  for (let i = 0; i < fresh.length; i += 400) {
    const batch = writeBatch(db)
    fresh.slice(i, i + 400).forEach((url, j) => {
      const seq = startSerial + i + j
      const name = names[i + j]
      batch.set(doc(matsCol(uid)), {
        subjectId,
        chapterId,
        title: name,
        baseTitle: title,
        serial: seq,
        googleDriveUrl: url,
        order: groupIndex * ORDER_GROUP + seq,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      created.push(name)
    })
    await batch.commit()
  }
  return { created, skipped: links.length - fresh.length }
}

export async function deleteStudyMaterial(uid: string, id: string): Promise<void> {
  // Daily subject study time is intentionally kept: it belongs to the Subject, not the PDF.
  const batch = writeBatch(db)
  batch.delete(doc(matsCol(uid), id))
  batch.delete(progressDoc(uid, id))
  await batch.commit()
}

// ── Progress ──────────────────────────────────────────────────────────

export async function getProgress(
  uid: string,
  rid: string
): Promise<StudyMaterialProgress | null> {
  const snap = await getDoc(progressDoc(uid, rid))
  return snap.exists() ? (snap.data() as StudyMaterialProgress) : null
}

export async function saveProgress(
  uid: string,
  m: Pick<StudyMaterial, 'id' | 'subjectId' | 'chapterId'>,
  data: { lastPage?: number; opened?: boolean }
): Promise<void> {
  const payload: Record<string, unknown> = {
    resourceId: m.id,
    subjectId: m.subjectId,
    chapterId: m.chapterId,
    updatedAt: serverTimestamp(),
  }
  if (data.lastPage !== undefined) payload.lastPage = data.lastPage
  if (data.opened) payload.lastOpenedAt = serverTimestamp()
  await setDoc(progressDoc(uid, m.id), payload, { merge: true })
}

/** All progress docs (one read) — used for "last read" hints on the list. */
export async function getAllProgress(uid: string): Promise<Record<string, StudyMaterialProgress>> {
  const snap = await getDocs(collection(db, USERS_COL, uid, SUB.STUDY_MATERIAL_PROGRESS))
  const out: Record<string, StudyMaterialProgress> = {}
  snap.docs.forEach((d) => (out[d.id] = d.data() as StudyMaterialProgress))
  return out
}

// ── Daily subject study time ──────────────────────────────────────────

/** Local calendar day as YYYY-MM-DD. */
export function localDateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * Atomically add seconds to today's total for a Subject.
 * Doc id = `${date}_${subjectId}` → one doc per user/day/subject, safe to
 * call repeatedly (server-side increment, no read-modify-write race).
 */
export async function addDailySubjectSeconds(
  uid: string,
  subjectId: string,
  seconds: number,
  meta?: { chapterId?: string; resourceId?: string }
): Promise<void> {
  const secs = Math.floor(seconds)
  if (!Number.isFinite(secs) || secs <= 0) return
  const date = localDateKey()
  const payload: Record<string, unknown> = {
    userId: uid,
    date,
    subjectId,
    totalSeconds: increment(secs),
    updatedAt: serverTimestamp(),
  }
  if (meta?.chapterId) payload.lastChapterId = meta.chapterId
  if (meta?.resourceId) payload.lastResourceId = meta.resourceId
  await setDoc(doc(dailyCol(uid), `${date}_${subjectId}`), payload, { merge: true })
}

/** Today's per-subject totals: { [subjectId]: seconds }. Single-field query, no index. */
export async function getTodaySubjectTimes(uid: string): Promise<Record<string, number>> {
  const snap = await getDocs(query(dailyCol(uid), where('date', '==', localDateKey())))
  const out: Record<string, number> = {}
  snap.docs.forEach((d) => {
    const t = d.data() as StudyMaterialDailyTime
    out[t.subjectId] = (out[t.subjectId] ?? 0) + (t.totalSeconds ?? 0)
  })
  return out
}
