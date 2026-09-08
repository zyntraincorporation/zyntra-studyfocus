/**
 * curriculum.service.ts
 *
 * All data lives under users/{userId}/ — no global collections.
 * Every function takes `userId` as the first parameter.
 *
 * Path structure:
 *   users/{userId}/subjects/{subjectId}
 *   users/{userId}/chapters/{chapterId}   (with subjectId FK)
 *   users/{userId}/lectures/{lectureId}   (with subjectId + chapterId FK)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { db } from './firebase'
import { USERS_COL, SUB } from '@/constants/firebase'
import type {
  Subject,
  Chapter,
  Lecture,
  SubjectInput,
  ChapterInput,
  LectureInput,
  ChapterResource,
} from '@/types/curriculum.types'


// ── Path helpers ──────────────────────────────────────────────────────

const subjectsCol = (uid: string) =>
  collection(db, USERS_COL, uid, SUB.SUBJECTS)

const subjectDoc = (uid: string, sid: string) =>
  doc(db, USERS_COL, uid, SUB.SUBJECTS, sid)

const chaptersCol = (uid: string) =>
  collection(db, USERS_COL, uid, SUB.CHAPTERS)

const chapterDoc = (uid: string, cid: string) =>
  doc(db, USERS_COL, uid, SUB.CHAPTERS, cid)

const lecturesCol = (uid: string) =>
  collection(db, USERS_COL, uid, SUB.LECTURES)

const lectureDoc = (uid: string, lid: string) =>
  doc(db, USERS_COL, uid, SUB.LECTURES, lid)

// ── Subjects ──────────────────────────────────────────────────────────

export async function getSubjects(userId: string): Promise<Subject[]> {
  const q = query(
    subjectsCol(userId),
    where('isActive', '==', true),
    orderBy('order', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Subject)
}

export async function getSubject(
  userId: string,
  subjectId: string
): Promise<Subject | null> {
  const snap = await getDoc(subjectDoc(userId, subjectId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Subject) : null
}

export async function createSubject(
  userId: string,
  input: SubjectInput,
  currentCount: number
): Promise<string> {
  const ref = await addDoc(subjectsCol(userId), {
    ...input,
    order: currentCount,
    isActive: true,
    lectureCount: 0,
    chapterCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateSubject(
  userId: string,
  subjectId: string,
  data: Partial<SubjectInput>
): Promise<void> {
  await updateDoc(subjectDoc(userId, subjectId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteSubject(
  userId: string,
  subjectId: string
): Promise<void> {
  // Soft delete
  await updateDoc(subjectDoc(userId, subjectId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  })
}

export async function reorderSubjects(
  userId: string,
  orderedIds: string[]
): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(subjectDoc(userId, id), {
      order: index,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

// ── Chapters ──────────────────────────────────────────────────────────

export async function getChapters(
  userId: string,
  subjectId: string
): Promise<Chapter[]> {
  const q = query(
    chaptersCol(userId),
    where('subjectId', '==', subjectId),
    where('isActive', '==', true),
    orderBy('order', 'asc')
  )
  const snap = await getDocs(q)
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Chapter)
  return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export async function getChapter(
  userId: string,
  chapterId: string
): Promise<Chapter | null> {
  const snap = await getDoc(chapterDoc(userId, chapterId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Chapter) : null
}

export async function createChapter(
  userId: string,
  input: ChapterInput,
  currentCount: number
): Promise<string> {
  const batch = writeBatch(db)

  const orderValue = typeof input.order === 'number' ? input.order : currentCount
  const cleanedInput = cleanUndefined(input)

  // Create chapter
  const newRef = doc(chaptersCol(userId))
  batch.set(newRef, {
    ...cleanedInput,
    order: orderValue,
    isActive: true,
    lectureCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Increment subject.chapterCount
  batch.update(subjectDoc(userId, input.subjectId), {
    chapterCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return newRef.id
}

export async function updateChapter(
  userId: string,
  chapterId: string,
  data: Partial<Pick<Chapter, 'name' | 'description' | 'order'>>
): Promise<void> {
  const cleanedData = cleanUndefined(data)
  await updateDoc(chapterDoc(userId, chapterId), {
    ...cleanedData,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteChapter(
  userId: string,
  chapterId: string,
  subjectId: string
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(chapterDoc(userId, chapterId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  })
  batch.update(subjectDoc(userId, subjectId), {
    chapterCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

export async function reorderChapters(
  userId: string,
  orderedIds: string[]
): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(chapterDoc(userId, id), {
      order: index,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

export async function updateChapterResources(
  userId: string,
  chapterId: string,
  resources: ChapterResource[]
): Promise<void> {
  await updateDoc(chapterDoc(userId, chapterId), {
    resources,
    updatedAt: serverTimestamp(),
  })
}

// ── Lectures ──────────────────────────────────────────────────────────


export async function getLectures(
  userId: string,
  chapterId: string
): Promise<Lecture[]> {
  const q = query(
    lecturesCol(userId),
    where('chapterId', '==', chapterId),
    where('isActive', '==', true),
    orderBy('order', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lecture)
}

export async function getLecture(
  userId: string,
  lectureId: string
): Promise<Lecture | null> {
  const snap = await getDoc(lectureDoc(userId, lectureId))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Lecture) : null
}

export async function getLecturesBySubject(
  userId: string,
  subjectId: string
): Promise<Lecture[]> {
  const q = query(
    lecturesCol(userId),
    where('subjectId', '==', subjectId),
    where('isActive', '==', true)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lecture)
}

function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Partial<T>
}

export async function createLecture(
  userId: string,
  input: LectureInput,
  currentCount: number
): Promise<string> {
  const batch = writeBatch(db)

  // Clean undefined properties so Firestore doesn't reject them
  const cleanedInput = cleanUndefined(input)

  // Create lecture
  const newRef = doc(lecturesCol(userId))
  batch.set(newRef, {
    ...cleanedInput,
    order: currentCount,
    isActive: true,
    isImportant: false,
    videoStatus: 'available',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // Increment chapter.lectureCount and subject.lectureCount atomically
  batch.update(chapterDoc(userId, input.chapterId), {
    lectureCount: increment(1),
    updatedAt: serverTimestamp(),
  })
  batch.update(subjectDoc(userId, input.subjectId), {
    lectureCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return newRef.id
}

export async function updateLecture(
  userId: string,
  lectureId: string,
  data: Partial<Pick<Lecture, 'title' | 'description' | 'isImportant' | 'videoStatus' | 'slideUrl' | 'timestamps' | 'attachments'>>
): Promise<void> {
  const cleanedData = cleanUndefined(data)
  await updateDoc(lectureDoc(userId, lectureId), {
    ...cleanedData,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteLecture(
  userId: string,
  lectureId: string,
  chapterId: string,
  subjectId: string
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(lectureDoc(userId, lectureId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  })
  batch.update(chapterDoc(userId, chapterId), {
    lectureCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
  batch.update(subjectDoc(userId, subjectId), {
    lectureCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

export async function reorderLectures(
  userId: string,
  orderedIds: string[]
): Promise<void> {
  const batch = writeBatch(db)
  orderedIds.forEach((id, index) => {
    batch.update(lectureDoc(userId, id), {
      order: index,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

export async function toggleImportant(
  userId: string,
  lectureId: string,
  current: boolean
): Promise<void> {
  await updateDoc(lectureDoc(userId, lectureId), {
    isImportant: !current,
    updatedAt: serverTimestamp(),
  })
}
