# IMPLEMENTATION ANALYSIS — ZyntraFocus (FocusLearn)

**Document Type:** Lead Architect Pre-Implementation Analysis
**Project:** ZyntraFocus — Distraction-Free Personal Learning Platform
**Prepared By:** Lead Product Architect & Senior Full-Stack Engineer
**Date:** 2026-08-26
**PRD Version:** 1.0
**Status:** Pre-Implementation — Awaiting Answers Before Coding Begins

---

> ⚠️ **NAMING DISCREPANCY NOTED**
>
> The project directory is named `ZyntraFocus`, but the PRD internally uses the name `FocusLearn`.
> This analysis uses **ZyntraFocus** as the canonical product name throughout.
> Before implementation begins, confirm which name to use in the application UI.

---

## 1. EXECUTIVE SUMMARY

ZyntraFocus is a full-stack personal learning management system (LMS) that wraps the YouTube embedded
player in a structured, distraction-free academic environment. The product requires a modern
React/TypeScript frontend, a Firebase backend (Authentication + Firestore + Storage), official YouTube
IFrame Player API integration, and Netlify deployment.

**Complexity Assessment:** Medium-to-high. Core technical challenges:

1. YouTube IFrame Player API behavioral constraints — many intended features are technically limited.
2. Firestore write optimization — progress autosave requires careful local-state buffering.
3. Admin role enforcement — must be server-side through Firestore Security Rules, never client-side only.
4. Search — Firestore has no native full-text search; client-side indexing strategy required.
5. Streak and analytics — require careful timezone handling and session deduplication.

The proposed stack (React + TypeScript + Vite + Tailwind + Firebase + YouTube IFrame API + Netlify) is
**appropriate and well-chosen**.

**Estimated V1 Build:** 15 development phases, approximately 8–12 weeks of focused development.

---

## 2. PRODUCT UNDERSTANDING

ZyntraFocus is a personal learning platform that solves a specific problem: YouTube is the world's
largest library of educational video content, but its interface is optimized for content discovery,
not disciplined studying.

### Who Is It For?
A serious student (likely an HSC/university student in Bangladesh) studying from long-form YouTube
educational content who needs: course-like organization, reliable resume-from-position, personal
timestamped notes and bookmarks, study time tracking with daily goals, and a distraction-free interface.

### What Makes It Different from YouTube?

| YouTube | ZyntraFocus |
|---|---|
| Content discovery engine | Course navigation system |
| Recommendations after video | Manual next lecture selection |
| Comments visible | No comments |
| Shorts feed | No Shorts |
| No progress tracking | Completion, position, percentage tracked |
| No note-taking | Timestamped notes tied to lectures |
| No study timer | Pomodoro + custom timer |
| No daily goals | Configurable daily study goals |
| No analytics | Subject/chapter/time analytics |
| No organization | Subject → Chapter → Lecture hierarchy |

---

## 3. PRD ANALYSIS

### 3.1 Authentication
- **Complexity:** Low | **V1:** Required
- Google Sign-In via Firebase Auth. Role (`student`/`admin`) stored in Firestore, validated server-side.
- User document created on first login using `setDoc` with `merge: true`.
- **Risk:** Admin assignment mechanism is undefined — critical gap (see Section 4, GAP-01).

### 3.2 Dashboard
- **Complexity:** Medium | **V1:** Required
- Aggregates from: progress, studySessions, notes, bookmarks subcollections.
- "Continue Learning" = most recent incomplete progress query.
- "Today's Goal" = aggregate sessions by `dateKey` (local date string).
- Streak read from user document (pre-computed, not recalculated per load).
- Subject progress computed client-side from loaded progress data.
- **Risk:** Must use batch reads + local cache — not individual Firestore reads per widget.

### 3.3 Subject System
- **Complexity:** Low | **V1:** Required
- `subjects/{subjectId}` collection. Admin CRUD. `order` for manual sort. `isActive` for soft-delete.
- **Decision:** Cover images = icon + color picker in V1 (no Firebase Storage uploads). Defer to V2.

### 3.4 Chapter System
- **Complexity:** Low | **V1:** Required
- `chapters/{chapterId}` with `subjectId` FK. Admin drag-and-drop reorder via batch writes.
- **Dependency:** Needs `@dnd-kit/core` library.

### 3.5 Lecture System
- **Complexity:** Low-Medium | **V1:** Required
- `lectures/{lectureId}` with denormalized `subjectId`, `chapterName`, `subjectName`.
- Duration stored in seconds (from YouTube Data API). `isImportant` flag by admin.
- **Risk:** Duration requires YouTube Data API, not just IFrame API.

### 3.6 YouTube Import
- **Complexity:** Medium | **V1:** Required
- URL parse → Video ID → YouTube Data API v3 (`videos.list`, parts: snippet+contentDetails+status)
- Check `status.embeddable` → Preview → Admin confirm → Save.
- **Risk:** API key must be domain-restricted. 10,000 units/day quota.

### 3.7 YouTube Player
- **Complexity:** High (API limitations) | **V1:** Required
- Official YouTube IFrame Player API. See full capability matrix in Section 5.

### 3.8 Progress Tracking
- **Complexity:** Medium | **V1:** Required
- Local state holds position (1s polling). Firestore write every 15s + on pause/visibility/navigation.
- `percentage = currentPosition / duration * 100`. `completed = percentage >= 90` OR manual.

### 3.9 Resume Playback
- **Complexity:** Low | **V1:** Required
- Fetch progress on lecture load. If `currentPosition > 30s`, show resume dialog.
- `player.seekTo(savedPosition, true)` fires AFTER `onReady` event.
- **Risk:** Race condition between seekTo and onReady is a common bug. Mobile needs user gesture first.

### 3.10 Timestamped Notes
- **Complexity:** Medium | **V1:** Required
- Capture `player.getCurrentTime()` when note editor opens. Store in `users/{uid}/notes/{noteId}`.
- Cross-page navigation to timestamp uses URL `?t=` query param.

### 3.11 Bookmarks
- **Complexity:** Low | **V1:** Required
- 6 categories: Important, Formula, Exam Question, Confusing, Revision, Example.
- Bookmarks page: filter by subject/chapter/category/lecture.

### 3.12 Study Timer (Custom + Pomodoro)
- **Complexity:** Medium | **V1:** Required
- UI-only, no Firestore during countdown. Use `Page Visibility API` + `Date.now()` for accuracy.

### 3.13 Daily Study Goals
- **Complexity:** Medium | **V1:** Required
- `dailyGoalMinutes` on user doc. Today's total = sum of session `duration` where `dateKey` = today.
- **Risk:** `dateKey` must be set in user's LOCAL timezone before writing.

### 3.14 Analytics
- **Complexity:** Medium | **V1:** Required (basic)
- Today/Week/Month totals from studySessions. Subject distribution by `subjectId` grouping.
- Weekly chart by `dateKey`. All client-side. Recharts for charts.

### 3.15 Streaks
- **Complexity:** Medium | **V1:** Required
- Stored on user doc: `{ streak, longestStreak, lastStreakDate }`.
- On app open: compare `lastStreakDate` to yesterday's local date → increment or reset.

### 3.16 Study Plans — **V2** (PRD Section 95)
### 3.17 Weak Topics — **V2** (PRD Section 95)
### 3.18 Revision Mode — **V2** (PRD Section 95)

### 3.19 Search
- **Complexity:** Medium | **V1:** Basic client-side
- Firestore has NO native full-text search. V1: All curriculum in memory → JS string matching.
- Ctrl+K overlay with debounced input and grouped results.

### 3.20 Admin Panel
- **Complexity:** Medium-High | **V1:** Required
- Protected by `role === 'admin'` in Security Rules. Aggregate counts via denormalized `adminStats`.

### 3.21 Video Health Monitoring
- **Complexity:** Medium | **V1:** Required (basic)
- `videoStatus` field on lecture. Admin triggers YouTube Data API re-validation.
- Batch check must be rate-limited. Updates `videoStatus` and `adminStats.unavailableVideos`.

### 3.22–3.27 PWA, Responsive, Dark Mode, Firebase, Netlify
- All Required for V1. Details in Sections 8–10, 17. No major risks beyond those already documented.

---

## 4. REQUIREMENTS GAPS

### GAP-01: Admin Account Assignment ⚠️ CRITICAL
PRD does NOT define how admin role is first assigned. Options: (A) Firebase Console manually,
(B) Hardcoded UID in rules, (C) Bootstrap script. **Required answer before implementation.**

### GAP-02: Timezone Handling ⚠️ IMPORTANT
Streaks, daily goals, analytics all depend on "today/yesterday." All day-boundary calculations must
use browser local timezone. `dateKey` field ('YYYY-MM-DD') must be set client-side in local timezone.

### GAP-03: First-Time User Experience
No onboarding flow defined. Dashboard assumes data exists. Need empty states + "Set daily goal" prompt.

### GAP-04: Data/Account Deletion
No account deletion mechanism defined. V1: "Reset all progress." Full deletion deferred to V2.

### GAP-05: Multi-Device Sync Conflict
Last-write-wins is acceptable for personal LMS. Document as known behavior.

### GAP-06: Firestore Composite Indexes
Multiple multi-field queries require composite indexes in `firestore.indexes.json`. Missing these
causes runtime errors. Must be created proactively (see Section 8 for full list).

### GAP-07: Session Integrity / Idle Detection
Auto-end session when: video paused > 5 min OR page hidden > 5 min OR user navigates away.
Maximum session cap: 4 hours (sanity check).

### GAP-08: YouTube API Key Security
Key in client bundle can be found. Mitigate: restrict in Google Cloud Console to production domain
+ localhost, and to YouTube Data API v3 only.

### GAP-09: Resource System Scope
PRD mentions PDF uploads. V1: Support external URLs only (Google Drive links). File uploads = V2.

### GAP-10: Lecture Denormalization
Lecture document needs `subjectId`, `subjectName`, `chapterName` denormalized to avoid join queries.
Not explicitly stated in PRD but technically required.

---

## 5. TECHNICAL RISKS

### 5.1 YouTube IFrame Player API — Capability Matrix

| Feature | Status | Notes |
|---|---|---|
| Embed video | ✅ SUPPORTED | Core |
| Play / Pause via API | ✅ SUPPORTED | `playVideo()` / `pauseVideo()` |
| Seek to timestamp | ✅ SUPPORTED | `seekTo(seconds, true)` |
| Get current time | ✅ SUPPORTED | `getCurrentTime()` — polling required |
| Get duration | ✅ SUPPORTED | `getDuration()` after onReady |
| Playback speed 0.25x–2x | ✅ SUPPORTED | Fixed set: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 |
| Playback speed 2.5x, 3x | ❌ NOT POSSIBLE | **PRD lists these — IFrame API does NOT support them** |
| Mute / Unmute | ✅ SUPPORTED | `mute()` / `unMute()` |
| Volume control | ✅ SUPPORTED | `setVolume(0–100)` |
| Fullscreen (browser) | ✅ SUPPORTED | `allowfullscreen` attribute on iframe |
| Custom overlay controls | ⚠️ LIMITED | Cannot overlay HTML on top of iframe |
| Hide related videos (end) | ⚠️ LIMITED | `rel=0` limits to same channel; cannot fully suppress |
| Hide YouTube branding | ❌ NOT POSSIBLE | ToS requires attribution |
| Mobile autoplay | ❌ NOT POSSIBLE | Browsers block without user gesture |
| Background audio (mobile) | ❌ NOT POSSIBLE | YouTube blocks background playback |
| Private video embedding | ❌ NOT POSSIBLE | Private videos cannot be embedded |
| Age-restricted video | ❌ NOT POSSIBLE | Cannot embed without iframe login |
| Quality control | ❌ DEPRECATED | `setPlaybackQuality()` no longer works |
| onStateChange events | ✅ SUPPORTED | PLAYING, PAUSED, ENDED, BUFFERING, CUED |
| onPlaybackRateChange | ✅ SUPPORTED | Detect user speed changes |

### 5.2 YouTube API Quota
- **Free quota:** 10,000 units/day. `videos.list` = 1 unit per call.
- **50 lecture imports:** 50 units. **384 health checks:** 384 units. Both fine.
- **Critical rule:** NEVER call YouTube Data API from student-facing pages.

### 5.3 Firebase Free Tier (Spark Plan)

| Resource | Free Limit | Expected Usage | Risk |
|---|---|---|---|
| Firestore reads | 50,000/day | ~500/day (1 user) | ✅ Very safe |
| Firestore writes | 20,000/day | ~1,500/day (15s progress save during 6h) | ✅ Safe |
| Firebase Storage | 5 GB total | Subject images only in V1 | ✅ Safe |
| Bandwidth | 10 GB/month | YouTube via YouTube CDN (not counted here) | ✅ Safe |

### 5.4 Netlify Risks

| Issue | Status | Mitigation |
|---|---|---|
| SPA 404 on refresh | ⚠️ Common | `_redirects`: `/* /index.html 200` |
| Firebase Auth domains | ⚠️ Required | Add Netlify domain to Firebase Auth authorized list |
| Env vars | ✅ Fine | `VITE_` prefix + Netlify dashboard |

### 5.5 Mobile Browser Restrictions

| Feature | Status |
|---|---|
| YouTube iframe autoplay | ❌ Blocked (iOS + Android) |
| Seeking before play gesture | ⚠️ May require user tap first |
| Fullscreen on iOS | ⚠️ Native fullscreen, iOS controls |
| Background audio | ❌ Stops when app is backgrounded |
| PWA on iOS | ⚠️ No push notifications, limited background sync |

---

## 6. RECOMMENDED ARCHITECTURE

```
[NETLIFY CDN — Static hosting + HTTPS + Env vars + Preview deployments]
                            |
        [REACT 18 FRONTEND — TypeScript + Vite + Tailwind CSS]
                            |
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
[Pages Layer]      [Application State]      [Services Layer]
DashboardPage      AuthContext              firebase.ts
SubjectPage        ThemeContext             auth.service.ts
ChapterPage        SettingsContext          curriculum.service.ts
LecturePage                                progress.service.ts
NotesPage          [Hooks Layer]            notes.service.ts
BookmarksPage      useAuth                  bookmarks.service.ts
AnalyticsPage      useYouTubePlayer         sessions.service.ts
SettingsPage       useProgress              analytics.service.ts
AdminPage          useNotes                 youtube.service.ts
AuthPage           useBookmarks
                   useStudySession
[Components]       useStudyTimer
Layout             useStreak
Video              useSearch
Notes              useKeyboardShortcuts
Bookmarks
Analytics
Admin
UI primitives
                            |                       |
              [FIREBASE BACKEND]          [YOUTUBE APIs]
              Auth (Google)               IFrame Player API
              Cloud Firestore             Data API v3 (admin only)
              Storage (images)
```

**Key Principles:**
- No component talks to Firestore directly — all through Services layer.
- Frontend role checks are UX-only; Security Rules enforce actual access control.
- `onSnapshot` listeners: ONLY for user document. Everything else uses `getDocs`.
- Local-first progress state: player → React state → periodic Firestore sync (not every second).

---

## 7. RECOMMENDED PROJECT STRUCTURE

```
ZyntraFocus/
├── public/
│   ├── icons/               # PWA icons (192x192, 512x512, maskable)
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── main.tsx
│   ├── App.tsx              # Router + Context providers
│   ├── pages/
│   │   ├── auth/LoginPage.tsx
│   │   ├── dashboard/DashboardPage.tsx
│   │   ├── subjects/SubjectsPage.tsx
│   │   ├── subjects/SubjectDetailPage.tsx
│   │   ├── chapters/ChapterDetailPage.tsx
│   │   ├── lectures/LecturePage.tsx        # Most complex page
│   │   ├── notes/NotesPage.tsx
│   │   ├── bookmarks/BookmarksPage.tsx
│   │   ├── analytics/AnalyticsPage.tsx
│   │   ├── settings/SettingsPage.tsx
│   │   ├── admin/AdminDashboard.tsx
│   │   ├── admin/AdminSubjectsPage.tsx
│   │   ├── admin/AdminChaptersPage.tsx
│   │   ├── admin/AdminLecturesPage.tsx
│   │   └── errors/NotFoundPage.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx        # Desktop sidebar nav
│   │   │   ├── BottomNav.tsx      # Mobile bottom nav
│   │   │   ├── Header.tsx
│   │   │   └── Breadcrumbs.tsx
│   │   ├── video/
│   │   │   ├── YouTubePlayer.tsx  # IFrame API wrapper
│   │   │   ├── PlayerControls.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── SpeedSelector.tsx
│   │   │   ├── ResumeDialog.tsx
│   │   │   └── FocusMode.tsx
│   │   ├── notes/
│   │   │   ├── NotePanel.tsx
│   │   │   ├── NoteCard.tsx
│   │   │   └── NoteEditor.tsx
│   │   ├── bookmarks/
│   │   │   ├── BookmarkPanel.tsx
│   │   │   └── BookmarkCard.tsx
│   │   ├── curriculum/
│   │   │   ├── SubjectCard.tsx
│   │   │   ├── ChapterList.tsx
│   │   │   ├── LectureCard.tsx
│   │   │   └── LectureStatusIcon.tsx
│   │   ├── dashboard/
│   │   │   ├── ContinueLearning.tsx
│   │   │   ├── DailyGoalCard.tsx
│   │   │   ├── StreakCard.tsx
│   │   │   ├── SubjectProgressCard.tsx
│   │   │   └── RecentActivity.tsx
│   │   ├── analytics/
│   │   │   ├── StudyTimeChart.tsx
│   │   │   ├── SubjectDistribution.tsx
│   │   │   └── StatsCard.tsx
│   │   ├── timer/
│   │   │   ├── StudyTimer.tsx
│   │   │   ├── PomodoroTimer.tsx
│   │   │   └── BreakReminder.tsx
│   │   ├── admin/
│   │   │   ├── YouTubeImporter.tsx
│   │   │   ├── SubjectEditor.tsx
│   │   │   ├── ChapterEditor.tsx
│   │   │   ├── LectureEditor.tsx
│   │   │   ├── DraggableList.tsx
│   │   │   └── VideoHealthBadge.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx
│   │       ├── Skeleton.tsx
│   │       ├── ProgressBar.tsx
│   │       ├── Badge.tsx
│   │       ├── Tabs.tsx
│   │       ├── EmptyState.tsx
│   │       └── ConfirmDialog.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useYouTubePlayer.ts    # IFrame API wrapper hook
│   │   ├── useProgress.ts         # Local buffer + Firestore sync
│   │   ├── useNotes.ts
│   │   ├── useBookmarks.ts
│   │   ├── useStudySession.ts
│   │   ├── useStudyTimer.ts
│   │   ├── useStreak.ts
│   │   ├── useSearch.ts
│   │   ├── useTheme.ts
│   │   └── useKeyboardShortcuts.ts
│   ├── services/
│   │   ├── firebase.ts
│   │   ├── auth.service.ts
│   │   ├── users.service.ts
│   │   ├── subjects.service.ts
│   │   ├── chapters.service.ts
│   │   ├── lectures.service.ts
│   │   ├── progress.service.ts
│   │   ├── notes.service.ts
│   │   ├── bookmarks.service.ts
│   │   ├── sessions.service.ts
│   │   ├── analytics.service.ts
│   │   └── youtube.service.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── SettingsContext.tsx
│   ├── types/
│   │   ├── user.types.ts
│   │   ├── curriculum.types.ts
│   │   ├── progress.types.ts
│   │   ├── notes.types.ts
│   │   ├── bookmarks.types.ts
│   │   ├── session.types.ts
│   │   ├── analytics.types.ts
│   │   └── youtube.types.ts
│   ├── utils/
│   │   ├── youtube.utils.ts
│   │   ├── time.utils.ts
│   │   ├── date.utils.ts
│   │   ├── progress.utils.ts
│   │   └── string.utils.ts
│   ├── constants/
│   │   ├── routes.ts
│   │   ├── firebase.ts
│   │   └── youtube.ts
│   └── styles/
│       ├── globals.css
│       └── fonts.css
├── .env.local                 # Gitignored
├── .env.example               # Committed
├── .gitignore
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
├── .firebaserc
├── netlify.toml
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 8. FIREBASE DATA ARCHITECTURE

### users/{userId}
```typescript
{
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: 'student' | 'admin';
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  dailyGoalMinutes: number;      // Default: 360
  streak: number;
  longestStreak: number;
  lastStreakDate: string;         // 'YYYY-MM-DD' local timezone
  preferredSpeed: number;         // Default: 1.0
  autoResume: boolean;
  theme: 'dark' | 'light' | 'system';
  breakReminderMinutes: number;  // Default: 50
  streakMinimumMinutes: number;  // Default: 30
}
```
Reads: On app load (once). Writes: On login, settings change. Security: Cannot change own role field.

---

### subjects/{subjectId}
```typescript
{
  id: string; name: string; description: string;
  icon: string;          // Lucide icon name or emoji
  color: string;         // Hex accent color
  order: number;
  isActive: boolean;
  lectureCount: number;  // Denormalized counter
  createdAt: Timestamp; updatedAt: Timestamp; createdBy: string;
}
```
Index: isActive ASC, order ASC

---

### chapters/{chapterId}
```typescript
{
  id: string; subjectId: string; subjectName: string;  // Denormalized
  name: string; description: string; order: number;
  isActive: boolean; lectureCount: number;              // Denormalized
  createdAt: Timestamp; updatedAt: Timestamp;
}
```
Index: subjectId ASC, order ASC

---

### lectures/{lectureId}
```typescript
{
  id: string; chapterId: string; subjectId: string;       // Denormalized
  chapterName: string; subjectName: string;               // Denormalized
  title: string; youtubeVideoId: string; youtubeUrl: string;
  thumbnailUrl: string;
  duration: number;         // Seconds (from YouTube Data API)
  durationFormatted: string;  // 'HH:MM:SS'
  channelName: string; description: string; order: number;
  isImportant: boolean; isActive: boolean;
  videoStatus: 'available' | 'unavailable' | 'private' | 'not_embeddable' | 'deleted' | 'unknown';
  lastCheckedAt: Timestamp | null;
  createdAt: Timestamp; updatedAt: Timestamp; createdBy: string;
}
```
Indexes: chapterId+order | subjectId+isImportant

---

### users/{userId}/progress/{lectureId}
```typescript
{
  lectureId: string; subjectId: string; chapterId: string;  // Denormalized
  currentPosition: number;  // Seconds
  duration: number;         // Cached
  percentage: number;       // 0–100
  completed: boolean; completedAt: Timestamp | null;
  lastWatchedAt: Timestamp;
  totalWatchTime: number;   // Cumulative seconds
}
```
**Highest write frequency.** Indexes: subjectId+lastWatchedAt DESC | chapterId+completed

---

### users/{userId}/notes/{noteId}
```typescript
{
  id: string; lectureId: string; subjectId: string; chapterId: string;
  lectureTitle: string; subjectName: string;   // Denormalized
  timestamp: number;    // Seconds in video
  content: string;
  category: 'general' | 'formula' | 'exam' | 'important' | 'revision' | 'confusing' | null;
  createdAt: Timestamp; updatedAt: Timestamp;
}
```
Indexes: subjectId+createdAt DESC | lectureId+timestamp ASC

---

### users/{userId}/bookmarks/{bookmarkId}
```typescript
{
  id: string; lectureId: string; subjectId: string; chapterId: string;
  lectureTitle: string; subjectName: string;   // Denormalized
  timestamp: number; label: string;
  category: 'important' | 'formula' | 'exam_question' | 'confusing' | 'revision' | 'example';
  createdAt: Timestamp;
}
```
Indexes: subjectId+category | lectureId+timestamp ASC

---

### users/{userId}/studySessions/{sessionId}
```typescript
{
  id: string; lectureId: string; subjectId: string; chapterId: string;
  subjectName: string;    // Denormalized
  startedAt: Timestamp; endedAt: Timestamp;
  duration: number;       // Seconds
  dateKey: string;        // 'YYYY-MM-DD' in user's LOCAL timezone — critical for analytics
}
```
Indexes: dateKey ASC | subjectId+dateKey ASC

---

### users/{userId}/settings/preferences
```typescript
{
  theme: 'dark' | 'light' | 'system';
  preferredSpeed: number; dailyGoalMinutes: number;
  autoResume: boolean; breakReminderEnabled: boolean;
  breakReminderMinutes: number;
  pomodoroStudyMinutes: number; pomodoroBreakMinutes: number;
  reducedMotion: boolean; focusModeDefault: boolean;
  streakMinimumMinutes: number; updatedAt: Timestamp;
}
```

---

### adminStats (single document)
```typescript
{
  totalSubjects: number; totalChapters: number;
  totalLectures: number; unavailableVideos: number;
  lastUpdated: Timestamp;
}
```
Updated via batch write on admin CRUD. Avoids count reads on every admin dashboard load.

---

### Required Composite Indexes (firestore.indexes.json)
```json
[
  {"collectionGroup":"subjects","fields":[{"fieldPath":"isActive"},{"fieldPath":"order"}]},
  {"collectionGroup":"chapters","fields":[{"fieldPath":"subjectId"},{"fieldPath":"order"}]},
  {"collectionGroup":"lectures","fields":[{"fieldPath":"chapterId"},{"fieldPath":"order"}]},
  {"collectionGroup":"lectures","fields":[{"fieldPath":"subjectId"},{"fieldPath":"isImportant"}]},
  {"collectionGroup":"progress","fields":[{"fieldPath":"subjectId"},{"fieldPath":"lastWatchedAt","order":"DESCENDING"}]},
  {"collectionGroup":"progress","fields":[{"fieldPath":"chapterId"},{"fieldPath":"completed"}]},
  {"collectionGroup":"notes","fields":[{"fieldPath":"subjectId"},{"fieldPath":"createdAt","order":"DESCENDING"}]},
  {"collectionGroup":"notes","fields":[{"fieldPath":"lectureId"},{"fieldPath":"timestamp"}]},
  {"collectionGroup":"bookmarks","fields":[{"fieldPath":"subjectId"},{"fieldPath":"category"}]},
  {"collectionGroup":"studySessions","fields":[{"fieldPath":"subjectId"},{"fieldPath":"dateKey"}]}
]
```

---

## 9. FIRESTORE SECURITY MODEL

### Conceptual Rule Design

```
// Helper: reads user's role from Firestore (server-side check)
function isAdmin() {
  return request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// All authenticated users can read active curriculum
match /subjects/{id}   { allow read: if request.auth != null; allow write: if isAdmin(); }
match /chapters/{id}   { allow read: if request.auth != null; allow write: if isAdmin(); }
match /lectures/{id}   { allow read: if request.auth != null; allow write: if isAdmin(); }

// Users can only access their own data
match /users/{userId} {
  allow read, write: if request.auth.uid == userId
    && !('role' in request.resource.data);  // Cannot change own role
}

// User subcollections: strict UID isolation
match /users/{userId}/progress/{lectureId}    { allow read, write: if request.auth.uid == userId; }
match /users/{userId}/notes/{noteId}          { allow read, write: if request.auth.uid == userId; }
match /users/{userId}/bookmarks/{bookmarkId}  { allow read, write: if request.auth.uid == userId; }
match /users/{userId}/studySessions/{id}      { allow read, write: if request.auth.uid == userId; }
match /users/{userId}/settings/{doc}          { allow read, write: if request.auth.uid == userId; }

// No unauthenticated access anywhere
```

**Critical Principles:**
1. Role check is server-side (inside Security Rules). Frontend checks are UX only.
2. Users cannot update their own `role` field.
3. `adminStats` writable only by admin.
4. No unauthenticated access to any collection.

---

## 10. PERFORMANCE AND COST PLAN

### Loading Strategy
| Data | Strategy |
|---|---|
| Subjects | Once on app start; cache in React state |
| Chapters | On demand when subject opened |
| Lectures | On demand when chapter opened |
| Progress (all) | All at once on app start; Map keyed by lectureId |
| Notes/Bookmarks | Per-lecture on player page; all on dedicated pages |
| Study sessions | Last 30 days only for analytics |
| User document | `onSnapshot` — 1 real-time connection |

### Progress Write Optimization (Local-First)
```
Player getCurrentTime() every 1s → Update React localProgress (NO write)
           ↓
Every 15s OR on pause/visibility-hide/navigate
           ↓
Single Firestore setDoc (merge: true) write
```
Max writes: ~1,500/day during 6h study. Free limit: 20,000/day. Very safe.

### Listener Strategy
- `onSnapshot`: ONLY user document (1 listener)
- ALL other data: `getDocs` (one-time reads)

### Search Strategy
- All curriculum in memory → client-side `.toLowerCase().includes(query)` — no Firestore reads at search time.

### Thumbnail Optimization
- YouTube CDN thumbnails — no Firebase Storage cost.
- `loading="lazy"` on all `<img>` tags.
- Use `hqdefault` (480×360) as fallback if `maxresdefault` is unavailable.

---

## 11. YOUTUBE INTEGRATION PLAN

### Step 1–3: Parse + Validate (client-side, instant)
```
Supported formats:
  youtube.com/watch?v=VIDEO_ID
  youtu.be/VIDEO_ID
  youtube.com/embed/VIDEO_ID
  youtube.com/shorts/VIDEO_ID

Video ID: exactly 11 chars matching [A-Za-z0-9_-]{11}
```

### Step 4: YouTube Data API v3 Call (admin only)
```
GET https://www.googleapis.com/youtube/v3/videos
  ?part=snippet,contentDetails,status
  &id={VIDEO_ID}
  &key={VITE_YOUTUBE_API_KEY}

Retrieved:
  snippet.title            → lecture title
  snippet.channelTitle     → channel name
  snippet.thumbnails       → thumbnail URL
  contentDetails.duration  → ISO 8601 (PT2H43M17S → seconds)
  status.embeddable        → boolean (CRITICAL)
  status.privacyStatus     → 'public' | 'private' | 'unlisted'
```

### Step 5: Embeddability Check
```
if (!video.status.embeddable || video.status.privacyStatus !== 'public')
  → block with descriptive error message
```
Note: `embeddable = true` at import time does NOT guarantee future embeddability.

### Step 6–7: Preview → Admin Confirms → Save to Firestore

### Step 8: Render IFrame Player
```javascript
new YT.Player(containerId, {
  videoId: lecture.youtubeVideoId,
  playerVars: {
    rel: 0,              // Limit related videos to same channel
    modestbranding: 1,   // Reduce YouTube logo
    enablejsapi: 1,      // Enable JS API
    origin: window.location.origin
  },
  events: { onReady, onStateChange, onError, onPlaybackRateChange }
});
```

### Step 9: Track State
```javascript
// Poll every 1 second
setInterval(() => {
  if (player.getPlayerState() === YT.PlayerState.PLAYING) {
    updateLocalProgress(player.getCurrentTime());
  }
}, 1000);

// Sync to Firestore every 15 seconds
setInterval(() => saveProgressToFirestore(localProgress), 15000);
```

### Step 10: Handle Player Errors
| Code | Meaning | User Message |
|---|---|---|
| 2 | Invalid parameter | "This video cannot be loaded." |
| 5 | HTML5 player error | "Playback error. Please try again." |
| 100 | Not found / private | "This lecture is currently unavailable." |
| 101/150 | Embedding not allowed | "This lecture cannot be embedded. Contact admin." |

---

## 12. ADMIN ARCHITECTURE

### Admin Login Flow
```
Login (Google) → role === 'admin' in AuthContext
           ↓
Admin sidebar navigation visible
           ↓
/admin → AdminDashboard (counts from adminStats document)
/admin/subjects → Subject CRUD
/admin/subjects/:id/chapters → Chapter CRUD + drag-reorder
/admin/chapters/:id/lectures → Lecture CRUD + drag-reorder + YouTube import
```

### YouTube Import Flow
```
Paste URL → Extract Video ID (instant) → Validate format (instant)
           ↓
YouTube Data API call (~500ms) → Loading skeleton shown
           ↓
Preview: thumbnail + editable title + channel + duration + embed status badge
           ↓
Admin clicks "Add Lecture"
           ↓
Firestore write (lectures/{id}) + adminStats.totalLectures++  (batch)
           ↓
Toast: "Lecture added" → Lecture appears in chapter list
```

### Drag-and-Drop Reorder
```
Admin drags to new position
           ↓
React state updates immediately (optimistic UI)
           ↓
Calculate new `order` values for affected items
           ↓
Firestore batch write (atomic: all succeed or all fail)
           ↓
On failure: revert React state + show error toast
```

---

## 13. USER EXPERIENCE ARCHITECTURE

### Complete User Journey
```
First Login
    → Google OAuth → Firebase session created
    → AuthContext detects new user → Create users/{uid} (role: 'student')
    → Redirect to Dashboard (empty states + "Set daily goal" prompt)
    → User sets daily goal
    ↓
Browse Subjects → Select Subject → Browse Chapters → Select Chapter → Browse Lectures
    ↓
Select Lecture → LecturePage loads
    → Fetch progress doc → Resume dialog if currentPosition > 30s
    → User clicks Resume → seekTo(savedPosition) after onReady
    → Study session starts (startedAt = now)
    ↓
Video plays → Progress saves every 15s
    → User takes timestamped note → Saved with current timestamp
    → User bookmarks moment → Category selected → Saved
    → Break reminder fires (non-blocking overlay)
    ↓
Video reaches 90% → Auto-marked completed → Toast
    → NextLectureCard shows → User manually clicks "Continue" (NO autoplay)
    ↓
Return to Dashboard:
    → Updated progress percentages
    → Streak checked/incremented
    → Daily goal updated
```

---

## 14. DEVELOPMENT PHASES

### Phase 0 — Project Setup & Tooling
**Goals:** Complete development environment from scratch.
**Tasks:** Vite+React+TypeScript init, Tailwind config with design tokens, React Router v6,
Firebase project + SDK init, .env.example, netlify.toml (SPA redirect), firestore.rules skeleton,
firestore.indexes.json skeleton, vite-plugin-pwa basic setup.
**AC:** `npm run dev` works. `npm run build` passes. Netlify preview deploys successfully.
**Dependencies:** None.

---

### Phase 1 — Design System Foundation
**Goals:** Build the complete base UI component library before any feature work.
**Tasks:** Typography (Inter + Noto Sans Bengali via Google Fonts), color system (dark/light/system
via Tailwind `darkMode: 'class'`), ALL base UI components (Button, Input, Modal, Toast, Skeleton,
Badge, Tabs, EmptyState, ConfirmDialog, ProgressBar), layout components (AppLayout, Sidebar,
BottomNav, Header, Breadcrumbs), ThemeContext with localStorage + Firestore persistence.
**AC:** All components correct in dark+light mode. Responsive 320px–1920px. No theme flash on reload.

---

### Phase 2 — Authentication
**Goals:** Firebase Auth with role-based access control.
**Tasks:** Google Sign-In, AuthContext (user/role/loading/error), user document creation on first
login, ProtectedRoute HOC, AdminRoute HOC, Login page, logout, auth state persistence on refresh.
**AC:** Login/logout works. Protected routes redirect correctly. Admin role enforced.
User document created on first login only. Role cannot be self-modified.
**Dependencies:** Phase 0, 1.

---

### Phase 3 — Curriculum (Student Read View)
**Goals:** Subject → Chapter → Lecture hierarchy for students.
**Tasks:** SubjectsPage, SubjectDetailPage, ChapterDetailPage, all services (subjects, chapters,
lectures), TypeScript type definitions, loading skeletons, empty states, LectureStatusIcon (○/◐/✓).
**AC:** Full curriculum navigation works. Breadcrumbs correct at every level.
Skeletons show before data. Empty states shown correctly.
**Dependencies:** Phase 1, 2.

---

### Phase 4 — Admin Panel (Curriculum Management)
**Goals:** Admin creates and manages the full curriculum.
**Tasks:** AdminDashboard (aggregate counts from adminStats), Subject CRUD, Chapter CRUD + reorder
(@dnd-kit/core), YouTubeImporter component, youtube.service.ts, Lecture CRUD + reorder + import,
batch writes for reorder, VideoHealthBadge, adminStats denormalized document management.
**AC:** Admin full CRUD works. YouTube import shows correct preview. Non-embeddable videos blocked.
Reorder persists after refresh. Admin counts accurate.
**Dependencies:** Phase 2, 3.

---

### Phase 5 — YouTube Player
**Goals:** Official IFrame Player with complete lecture page layout.
**Tasks:** YouTubePlayer.tsx (IFrame API wrapper component), useYouTubePlayer hook, SpeedSelector
(0.5x–2x ONLY — NOT 2.5x/3x), fullscreen (allowfullscreen attribute), player error handling
(codes 2/5/100/101/150), complete LecturePage layout (breadcrumb + video + controls + next lecture),
preferred speed persistence in user settings.
**AC:** Valid video plays. Speed changes and persists across lectures. All error codes show
user-friendly messages. Private/non-embeddable shows correct error. Mobile 16:9 ratio correct.
**Dependencies:** Phase 3.

---

### Phase 6 — Progress Tracking & Resume
**Goals:** Local-first progress with Firestore sync, completion, and resume.
**Tasks:** useProgress hook (local buffer + 15s Firestore sync), save on pause/visibility/navigate,
ResumeDialog component, manual "Mark Complete" button, 90% auto-completion detection, chapter/subject
progress percentage calculation, useStudySession hook, idle detection (5 min → session auto-end).
**AC:** Progress survives refresh. Resume dialog shows correct timestamp. seekTo works reliably
after onReady. Chapter/subject percentages accurate. Idle time not counted as study time.
**Dependencies:** Phase 5.

---

### Phase 7 — Notes & Bookmarks
**Goals:** Complete note and bookmark systems with cross-page navigation.
**Tasks:** NoteEditor + NotePanel on lecture page, useNotes CRUD hook, jump-to-timestamp from note
(seekTo), NotesPage with subject filter + text search, cross-page navigation via ?t= URL param,
BookmarkPanel with category selector, useBookmarks CRUD hook, BookmarksPage with multi-filter.
**AC:** Notes saved with correct timestamp. Clicking note seeks player. Notes page filter works.
Text search finds notes. Bookmarks work with all 6 categories. Cross-page seek via ?t= works.
**Dependencies:** Phase 5, 6.

---

### Phase 8 — Dashboard
**Goals:** Complete Dashboard with live data from Firestore.
**Tasks:** ContinueLearning (recent incomplete progress), DailyGoalCard (aggregate today's sessions
by dateKey), StreakCard (from user doc), streak calculation logic (on app open), SubjectProgressCard
(from progress data), RecentActivity, "What Should I Study Now?" deterministic logic, greeting.
**AC:** All Dashboard sections show correct data. Daily goal accurate. Streak increments on
qualifying days. Streak resets after a missed day.
**Dependencies:** Phase 6, 7.

---

### Phase 9 — Study Timer & Focus Mode
**Goals:** Timer system and Focus Mode.
**Tasks:** StudyTimer + PomodoroTimer components, useStudyTimer hook (state machine),
BreakReminder overlay, FocusMode (hide nav/sidebar), keyboard shortcuts (Space, arrows, M, F, B,
N, P, Ctrl+K, Esc), Page Visibility API for accurate timer across tab switches.
**AC:** Pomodoro cycles correctly. Break reminder fires at configured interval.
Focus Mode hides navigation. Keyboard shortcuts work when iframe not focused. Timer accurate.
**Dependencies:** Phase 5, 8.

---

### Phase 10 — Analytics
**Goals:** Full analytics page with charts.
**Tasks:** AnalyticsPage, StudyTimeChart (Recharts BarChart), SubjectDistribution (PieChart),
weekly activity chart, all calculations from studySessions with correct local timezone handling.
**AC:** Totals correct. Charts render in both themes. Distribution accurate. No timezone bugs.
**Dependencies:** Phase 6, 8.

---

### Phase 11 — Search
**Goals:** Global Ctrl+K search overlay.
**Tasks:** SearchOverlay component, useSearch hook (client-side across all loaded data),
debounced input, grouped results (subjects/chapters/lectures/notes/bookmarks), navigate on click.
**AC:** Ctrl+K opens search. Results appear as user types. Navigation on click correct.
Empty state shown when no results.
**Dependencies:** Phase 3, 7.

---

### Phase 12 — Security Hardening
**Goals:** Complete and tested Firebase Security Rules.
**Tasks:** Complete firestore.rules (all collections), storage.rules, test via Firebase Rules
Simulator, verify role self-modification blocked, verify data isolation between users,
review all env vars (none hardcoded), XSS audit of user inputs.
**AC:** All Rules Simulator tests pass. Student cannot write curriculum. Cross-user data access
denied. No secrets in Git repository.
**Dependencies:** All previous phases.

---

### Phase 13 — PWA Finalization
**Goals:** Complete PWA for installability.
**Tasks:** vite-plugin-pwa config with correct manifest, all icon sizes (192, 512, maskable),
service worker caching (app shell ONLY — no YouTube streams), offline detection + friendly message.
**AC:** App installable on Android Chrome. App shell loads from cache when offline.
Video shows "offline" message without internet.
**Dependencies:** Phase 0.

---

### Phase 14 — Testing & Bug Fixes
**Goals:** Systematic testing of all features.
Auth flows | Admin CRUD | YouTube import (valid/invalid/private/non-embeddable/all URL formats) |
Player (play/pause/speed/seek/errors) | Progress (save/reload/resume/completion) |
Notes/Bookmarks | Analytics/Streak | Responsive (375px/768px/1280px) | Dark/light | Keyboard |
Security Rules | Mobile (real device).

---

### Phase 15 — Production Deployment
**Goals:** Full production deployment on Netlify.
**Tasks:** Set all VITE_ env vars in Netlify dashboard, add Netlify domain to Firebase Auth,
deploy Firestore rules + indexes to production, `npm run build`, Netlify production deploy,
end-to-end production test, verify HTTPS + SPA routing + Google Auth popup on production domain.

---

## 15. MVP DEFINITION

### MUST HAVE (V1 — Launch Blockers)
Firebase Auth (Google) | Subject/Chapter/Lecture hierarchy | Admin YouTube import + embeddability check |
YouTube IFrame player | Progress tracking (local-first) | Resume from position | Playback speed (0.5x–2x) |
Lecture completion tracking | Chapter + Subject progress | Timestamped notes | Bookmarks with categories |
Focus Mode | Study timer + Pomodoro | Break reminders | Daily study goal | Dashboard (full) |
Basic analytics | Admin panel (CRUD + reorder) | Video health status | Dark mode (default) |
Responsive design | Firebase Security Rules | Netlify deployment

### SHOULD HAVE (V1 — Important but not blocking)
Global search (Ctrl+K) | Keyboard shortcuts | PWA installation | "What should I study now?" |
Empty states + error states | Skeleton loaders | Toast notifications

### NICE TO HAVE (V2)
Revision Mode | Weak Topic System | Study Plans | Advanced analytics | Bulk CSV import |
PDF resource attachment | Email/password auth | PWA push notifications

### FUTURE (V3+)
AI study assistant | AI quiz from notes | Flashcards | Exam countdown | HSC syllabus tracking | Multi-user

---

## 16. TESTING STRATEGY

**Auth:** Login, logout, refresh, protected route, admin route, role self-modification attempt.

**Curriculum:** Full admin CRUD, reorder persistence, YouTube import
(valid / invalid / private / non-embeddable / all URL formats).

**Player:** Valid video loads and plays, speed preference remembered, error codes handled,
seek from note, fullscreen, mobile 16:9 ratio.

**Progress:** Saves correctly, survives refresh, resume seeks to correct position,
90% auto-completion, manual mark complete, chapter/subject percentages accurate, idle detection.

**Notes:** Save with timestamp, edit, delete, jump-to-timestamp, Notes page filter, text search.

**Bookmarks:** Save with category, delete, filter on Bookmarks page, jump-to-timestamp cross-page.

**Analytics:** Today/week/month totals accurate, subject distribution chart, timezone correctness.

**Streak:** Increment on qualifying day (≥30 min study), reset after missed day,
edge case: study at 23:59 then 00:01 AM.

**Responsive:** 375px mobile, 768px tablet, 1280px desktop. Lecture page video ratio.

**Security Rules (Firebase Simulator):**
- Student reads subjects → allowed
- Student writes subjects → denied
- Student reads own notes → allowed
- Student reads other user's notes → denied
- Student changes own role → denied
- Admin writes subjects → allowed

---

## 17. DEPLOYMENT PLAN

### Environment Variables
```bash
# .env.example (committed to Git)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_YOUTUBE_API_KEY=
VITE_APP_NAME=ZyntraFocus
```

### Netlify Configuration
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Firebase CLI Deployment
```bash
npm install -g firebase-tools
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

### Production Checklist
```
[ ] All VITE_ env vars set in Netlify dashboard
[ ] Netlify domain added to Firebase Auth authorized domains
[ ] Firestore Security Rules deployed (NOT in test mode)
[ ] Composite indexes deployed and built
[ ] YouTube API key restricted to production domain
[ ] npm run build passes with zero TypeScript errors
[ ] Netlify production deploy succeeds
[ ] End-to-end test: login → browse → watch video → save note → bookmark
[ ] Mobile tested on real device
[ ] HTTPS verified (automatic on Netlify)
[ ] SPA routing verified (refresh on /subjects/ works)
```

---

## 18. QUESTIONS I NEED YOU TO ANSWER

*(এই section টি বাংলায় লেখা হয়েছে যাতে আপনি সহজে বুঝতে এবং উত্তর দিতে পারেন।)*

### A. Product Decisions (পণ্য সংক্রান্ত সিদ্ধান্ত)

**Q1. [REQUIRED — Implementation শুরুর আগেই দরকার]**
ZyntraFocus কি শুধুমাত্র আপনার personal use এর জন্য, নাকি ভবিষ্যতে অন্য students-ও
account খুলতে পারবে?

কেন জিজ্ঞেস করছি: এটি পুরো data model, security rules, এবং scalability কে প্রভাবিত করে।
শুধু আপনার জন্য হলে architecture অনেক সহজ হবে।
Recommended: V1 শুধুমাত্র personal use (১ admin + ১ student account)।

---

**Q2. [REQUIRED]**
PRD-এ product-এর নাম "FocusLearn" কিন্তু project folder-এর নাম "ZyntraFocus"।
UI-তে, browser tab-এ, PWA icon-এ কোন নামটি দেখাবে?

Recommended: ZyntraFocus — কারণ এটাই আপনার confirmed project name।

---

**Q3. [REQUIRED]**
Admin account প্রথমবার কীভাবে setup করতে চান?

Option A: Firebase Console থেকে manually role: admin set করবেন (সহজ, V1-এর জন্য যথেষ্ট)।
Option B: Specific email Security Rules-এ hardcode করব।
Option C: Bootstrap script বানাব যা first user-কে admin করে।

Recommended: Option A — Firebase Console থেকে manually। সহজ এবং নিরাপদ।

---

**Q4.**
Lecture completion threshold কত রাখতে চান? PRD-এ ≥90% আছে।
3 ঘণ্টার lecture-এ শেষের 18 মিনিট না দেখলে completed হবে না — এটা ঠিক আছে?

Recommended: 85% বা 90% — আপনার পছন্দ।

---

**Q5.**
Deleted বা private হয়ে যাওয়া lecture কি student-এর list-এ দেখাবে (error message সহ),
নাকি hide করব?

Recommended: দেখাবে কিন্তু "This lecture is currently unavailable" message দেখাবে।
Hide করব না — student-এর notes/bookmarks সেই lecture-এ আছে।

---

### B. User Experience (ব্যবহারকারীর অভিজ্ঞতা)

**Q6.**
Resume dialog কত সেকেন্ড দেখার পর থেকে দেখাবে? মাত্র 5 সেকেন্ড দেখলে resume জিজ্ঞেস করা কি দরকার?

Recommended: 30 seconds এর বেশি হলে resume dialog দেখাবে।

---

**Q7.**
Lecture শেষ হওয়ার পর auto-advance হবে নাকি সম্পূর্ণ manual?

PRD বলেছে: "student explicitly chooses" — কোনো autoplay নেই। Confirm করুন।

---

**Q8.**
Focus Mode-এ YouTube-এর native controls দেখাবে নাকি custom controls চান?

Technical note: YouTube iframe-এর ভেতরের controls আমরা পরিবর্তন করতে পারি না।
আমাদের extra controls (speed selector, bookmark, note button) iframe-এর নিচে রাখব।
Recommended: YouTube native controls + আমাদের extra controls নিচে।

---

**Q9.**
Streak-এ কোনো grace period চান? একদিন miss করলে কি সরাসরি reset হবে?

Recommended: V1-এ grace period নেই। একদিন miss = streak reset। সহজ এবং honest।

---

### C. Authentication (অ্যাকাউন্ট)

**Q10. [REQUIRED]**
শুধু Google Sign-In যথেষ্ট, নাকি Email/Password login-ও V1-এ দরকার?

Recommended: V1-এ শুধু Google Sign-In। PRD-ও বলেছে email/password "may be added later"।

---

**Q11.**
Account delete বা progress reset করার feature কি V1-এ দরকার?

Recommended: V1-এ "Reset all progress" option। Full account deletion V2-তে।

---

### D. YouTube (ভিডিও সংক্রান্ত)

**Q12. [REQUIRED]**
YouTube Data API key কি আপনার কাছে আছে? না থাকলে Google Cloud Console-এ
YouTube Data API v3 enable করে একটি API key তৈরি করতে হবে।

---

**Q13. [REQUIRED]**
PRD-এ 2.5x এবং 3x playback speed উল্লেখ আছে কিন্তু YouTube IFrame API সেগুলো
support করে না — maximum হলো 2x। এটা কি acceptable?

Technical fact: YouTube IFrame API officially supports: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2x only।
Recommended: 2x পর্যন্তই রাখুন। PRD update করুন।

---

**Q14.**
YouTube Shorts URL কি support করতে চান? (youtube.com/shorts/VIDEO_ID)

Recommended: হ্যাঁ, URL parser-এ handle করব। UI-তে special treatment দেব না।

---

### E. Firebase (ডেটাবেস)

**Q15. [REQUIRED]**
Firebase project কি আগে থেকে তৈরি আছে, নাকি শুরু থেকে setup করতে হবে?

---

**Q16.**
Firebase Spark (free) plan নাকি Blaze (pay-as-you-go) plan ব্যবহার করবেন?

Recommended: V1-এ Spark plan যথেষ্ট। Daily usage free limit-এর অনেক নিচে থাকবে।

---

**Q17.**
Video কতক্ষণ pause থাকলে study session auto-end হবে?

Recommended: 5 মিনিট pause বা 5 মিনিট page hidden → session auto-end।

---

### F. Admin (অ্যাডমিন)

**Q18.**
Admin panel কি /admin route-এ থাকবে নাকি আলাদা subdomain-এ?

Recommended: /admin route — একই Netlify project-এ সহজ।

---

**Q19.**
Admin কি YouTube import-এর পর lecture-এর title edit করতে পারবে?

Recommended: হ্যাঁ। YouTube title default হিসেবে দেখাবে, admin পরিবর্তন করতে পারবে।

---

**Q20.**
একজনের বেশি admin কি V1-এ দরকার?

Recommended: না — V1-এ single admin। পরে সহজে expand করা যাবে।

---

### G. Study Features (পড়াশোনার ফিচার)

**Q21.**
Daily goal কি সব device-এ sync হবে (Firestore), নাকি শুধু এই device-এ (localStorage)?

Recommended: Firestore-এ save করুন — সব device-এ sync হবে।

---

**Q22.**
Pomodoro-র default কি 50 min study / 5 min break? User settings-এ change করতে পারবে?

Recommended: হ্যাঁ, 50/5 default এবং settings-এ configurable।

---

**Q23.**
Break reminder কি video pause করবে automatically, নাকি শুধু overlay দেখাবে?

Recommended: শুধু non-blocking overlay। Auto-pause optional setting হিসেবে রাখুন।

---

### H. Design / Branding (ডিজাইন)

**Q24.**
PRD-এ color system দেওয়া আছে (dark #0B0F14, primary #6366F1)। এটাই final?

---

**Q25.**
Interface language কি ইংরেজি, বাংলা, নাকি bilingual?

Recommended: V1-এ সম্পূর্ণ ইংরেজি interface। Lecture title বাংলায় হলেও সেটা data, UI নয়।

---

**Q26.**
Noto Sans Bengali font কি V1-এই দরকার?

Recommended: Interface ইংরেজিতে রাখলে V2-তে পারবে। বাংলা interface হলে V1-এই লাগবে।

---

### I. Deployment (Deployment)

**Q27. [REQUIRED]**
Netlify account কি আছে এবং GitHub repository তৈরি করা হয়েছে?

---

**Q28.**
Custom domain ব্যবহার করবেন (zyntrafocus.com), নাকি Netlify subdomain যথেষ্ট?

Recommended: V1-এ Netlify subdomain (zyntrafocus.netlify.app)। Custom domain পরে।

---

### J. Future Plans (ভবিষ্যৎ পরিকল্পনা)

**Q29.**
HSC 2027 exam preparation কি primary use case? Exam countdown feature-এর priority ঠিক করতে জানা দরকার।

---

**Q30.**
ভবিষ্যতে AI features (quiz generator, revision planner) add করার পরিকল্পনা আছে?
এটা জানলে data model কিছুটা forward-compatible রাখব।

---

## 19. FINAL RECOMMENDATION

### Recommended Stack (Confirmed Appropriate)
```
React 18 + TypeScript + Vite + Tailwind CSS
Firebase Auth + Cloud Firestore + Firebase Storage
YouTube IFrame Player API + YouTube Data API v3
React Router v6 | Lucide React | Recharts
@dnd-kit/core (drag-and-drop — required but not in PRD)
vite-plugin-pwa | Netlify
```

### Recommended V1 Scope
Build exactly what PRD Section 94 defines. Do not let scope creep in.
The absolute core: Player + Progress + Resume + Notes + Bookmarks + Focus Mode.

### Biggest Technical Risks
1. YouTube IFrame API on mobile — seek/autoplay/fullscreen inconsistent on iOS/Android. Test early.
2. Firestore write frequency — local-state buffering for progress is mandatory from Day 1.
3. YouTube API quota — never call from student-facing pages; admin-only, on explicit action.
4. Admin role bootstrap — must be resolved before any other admin feature is secured.

### Biggest Product Risks
1. Embeddability changes — lecture working today may not work tomorrow. Video health monitoring critical.
2. Feature creep — build phase-by-phase. A working V1 > half-built V2.
3. Unanswered questions — Q1, Q2, Q3 must be answered before architecture is finalized.

### Recommended Next Step
Answer the REQUIRED questions: Q1, Q2, Q3, Q10, Q12, Q13, Q15, Q27.
After your answers, implementation begins with Phase 0.
One phase at a time. Review before proceeding. Never more than one phase ahead without approval.

---

*This document represents a complete pre-implementation architectural analysis.*
*No production code has been written. No project files have been modified.*
*Implementation begins only after the required questions are answered.*

---
IMPLEMENTATION_ANALYSIS.md — ZyntraFocus
Prepared: 2026-08-26 | Version: 1.0
