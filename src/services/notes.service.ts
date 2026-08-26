import {
  collection, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, doc, getDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { COLLECTIONS, SUBCOLLECTIONS } from '@/constants/firebase'
import type { Note, NoteCategory } from '@/types/notes.types'

const notesCol = (uid: string) =>
  collection(db, COLLECTIONS.USERS, uid, SUBCOLLECTIONS.NOTES)

const noteRef = (uid: string, noteId: string) =>
  doc(db, COLLECTIONS.USERS, uid, SUBCOLLECTIONS.NOTES, noteId)

// Get notes for a single lecture
export async function getNotes(userId: string, lectureId: string): Promise<Note[]> {
  const q = query(notesCol(userId), where('lectureId', '==', lectureId), orderBy('timestamp', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Note)
}

// Get all notes (Notes page — all lectures)
export async function getAllNotes(userId: string): Promise<Note[]> {
  const q = query(notesCol(userId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Note)
}

// Create and return full Note object
export async function createNote(
  userId: string,
  data: {
    lectureId: string; subjectId: string; chapterId: string
    lectureTitle: string; subjectName: string; chapterName: string
    timestamp: number; content: string; category: NoteCategory
  }
): Promise<Note> {
  const ref = await addDoc(notesCol(userId), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  const snap = await getDoc(ref)
  return { id: snap.id, ...snap.data() } as Note
}

export async function updateNote(
  userId: string, noteId: string, content: string, category: NoteCategory
): Promise<void> {
  await updateDoc(noteRef(userId, noteId), { content, category, updatedAt: serverTimestamp() })
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  await deleteDoc(noteRef(userId, noteId))
}
