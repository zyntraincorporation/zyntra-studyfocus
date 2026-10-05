import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getSubjects } from '@/services/curriculum.service'
import { getAllChapters, getAllStudyMaterials } from '@/services/studyMaterials.service'
import type { Subject, Chapter } from '@/types/curriculum.types'
import type { StudyMaterial } from '@/types/studyMaterials.types'

/** Loads existing Subjects + Chapters and the NEW study-materials collection only. */
export function useStudyCatalog() {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    const [s, c, m] = await Promise.all([
      getSubjects(user.uid),
      getAllChapters(user.uid),
      getAllStudyMaterials(user.uid),
    ])
    setSubjects(s)
    setChapters(c)
    setMaterials(m)
    setLoading(false)
  }, [user])

  useEffect(() => {
    reload().catch(() => setLoading(false))
  }, [reload])

  return { subjects, chapters, materials, loading, reload }
}
