import {
  collection, addDoc, deleteDoc, getDocs,
  query, where, orderBy, doc, getDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { COLLECTIONS, SUBCOLLECTIONS } from '@/constants/firebase'
import type { Bookmark, BookmarkCategory } from '@/types/bookmarks.types'

const bmCol = (uid: string) =>
  collection(db, COLLECTIONS.USERS, uid, SUBCOLLECTIONS.BOOKMARKS)

const bmRef = (uid: string, bmId: string) =>
  doc(db, COLLECTIONS.USERS, uid, SUBCOLLECTIONS.BOOKMARKS, bmId)

// Get bookmarks for a single lecture
export async function getBookmarks(userId: string, lectureId: string): Promise<Bookmark[]> {
  const q = query(bmCol(userId), where('lectureId', '==', lectureId), orderBy('timestamp', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bookmark)
}

// Get all bookmarks (Bookmarks page)
export async function getAllBookmarks(userId: string): Promise<Bookmark[]> {
  const q = query(bmCol(userId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bookmark)
}

// Create and return full Bookmark object
export async function createBookmark(
  userId: string,
  data: {
    lectureId: string; subjectId: string; chapterId: string
    lectureTitle: string; subjectName: string
    timestamp: number; label: string; category: BookmarkCategory
  }
): Promise<Bookmark> {
  const ref = await addDoc(bmCol(userId), { ...data, createdAt: serverTimestamp() })
  const snap = await getDoc(ref)
  return { id: snap.id, ...snap.data() } as Bookmark
}

export async function deleteBookmark(userId: string, bookmarkId: string): Promise<void> {
  await deleteDoc(bmRef(userId, bookmarkId))
}
