/**
 * trash.service.ts
 *
 * Handles moving deleted resources/notes to Trash under users/{userId}/trash,
 * listing them in Settings, restoring them to their original chapter, or permanently deleting them.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { USERS_COL, SUB } from '@/constants/firebase'
import type { TrashedItem } from '@/types/trash.types'
import type { ChapterResource, Chapter } from '@/types/curriculum.types'

const trashCol = (uid: string) =>
  collection(db, USERS_COL, uid, SUB.TRASH)

const trashDoc = (uid: string, trashId: string) =>
  doc(db, USERS_COL, uid, SUB.TRASH, trashId)

const chapterDoc = (uid: string, cid: string) =>
  doc(db, USERS_COL, uid, SUB.CHAPTERS, cid)

/**
 * Move a resource or note to Trash
 */
export async function moveToTrash(
  userId: string,
  item: Omit<TrashedItem, 'id' | 'deletedAt'>
): Promise<string> {
  const data = {
    ...item,
    deletedAt: Date.now(),
  }
  const ref = await addDoc(trashCol(userId), data)
  return ref.id
}

/**
 * Get all trashed items for a user, sorted by most recently deleted
 */
export async function getTrashedItems(userId: string): Promise<TrashedItem[]> {
  const q = query(trashCol(userId), orderBy('deletedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrashedItem)
}

/**
 * Restore a trashed item back to its original chapter resources
 */
export async function restoreTrashedItem(
  userId: string,
  item: TrashedItem
): Promise<{ success: boolean; error?: string }> {
  try {
    if (item.type === 'resource' && item.chapterId) {
      const cRef = chapterDoc(userId, item.chapterId)
      const cSnap = await getDoc(cRef)

      if (!cSnap.exists()) {
        return {
          success: false,
          error: 'Original chapter was deleted, cannot restore here.',
        }
      }

      const chapterData = cSnap.data() as Chapter
      const currentResources: ChapterResource[] = chapterData.resources || []

      const restored: ChapterResource = {
        id: item.originalId || item.id,
        title: item.title,
        type: item.resourceType,
        createdAt: item.createdAt || Date.now(),
        ...(item.url ? { url: item.url } : {}),
        ...(item.rawContent ? { rawContent: item.rawContent } : {}),
        ...(item.htmlContent ? { htmlContent: item.htmlContent } : {}),
        ...(item.isCustomHtml ? { isCustomHtml: item.isCustomHtml } : {}),
      }

      // Add back if not already there
      const updatedResources = currentResources.some((r) => r.id === restored.id)
        ? currentResources
        : [...currentResources, restored]

      await updateDoc(cRef, {
        resources: updatedResources,
        updatedAt: serverTimestamp(),
      })
    }

    // Remove from trash
    await deleteDoc(trashDoc(userId, item.id))
    return { success: true }
  } catch (err: any) {
    console.error('Error restoring trashed item:', err)
    return { success: false, error: err.message || 'Failed to restore item' }
  }
}

/**
 * Permanently delete a single item from Trash
 */
export async function permanentlyDeleteTrashedItem(
  userId: string,
  trashId: string
): Promise<void> {
  await deleteDoc(trashDoc(userId, trashId))
}

/**
 * Empty all items from Trash
 */
export async function emptyAllTrash(userId: string): Promise<void> {
  const snap = await getDocs(trashCol(userId))
  if (snap.empty) return

  const batch = writeBatch(db)
  snap.docs.forEach((d) => {
    batch.delete(d.ref)
  })
  await batch.commit()
}
