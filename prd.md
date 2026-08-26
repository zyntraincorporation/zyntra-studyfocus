# FocusLearn

## Distraction-Free Personal Learning Platform

 Product Type:  Personal Learning Management System (LMS)
 Primary Platform:  Responsive Web Application / PWA
 Deployment:  Netlify
 Backend:  Firebase
 Video Source:  Official YouTube Embedded Player
 Primary User:  Student
 Development Environment:  Antigravity + Claude Sonnet
 Document Status:  Master PRD
 Version:  1.0 # 1. PRODUCT VISION

FocusLearn is a distraction-free personal learning platform designed to transform publicly available, embeddable YouTube educational videos into a structured, course-like learning experience.

The platform does NOT host, download, rip, re-upload, or redistribute YouTube videos.

Instead:

* YouTube remains the video source.
* FocusLearn provides the structured learning environment.
* Students organize lectures into Subjects → Chapters → Lectures.
* Students watch lectures through the official YouTube embedded player.
* FocusLearn tracks lear progress, notes, bookmarks, study time, completion, goals, and revision activity.

## Core Philosophy

YouTube is excellent at distributing educational content.

YouTube is not optimized for focused studying.

FocusLearn solves the second problem.

### Product Principle

> Content comes from YouTube.
> Structure, organization, progress, and focus come from FocusLearn. # 2. PROBLEM STATEMENT

Students frequently face the following problems when studying from long-form YouTube lectures:

1. Lectures can be 3–7 hours long.
2. Students cannot comfortably watch such lectures continuously.
3. YouTube exposes Shorts and recommended videos.
4. Comments create unnecessary distraction.
5. Homepage browsing creates temptation.
6. Related videos encourage context switching.
7. Students forget where they stopped.
8. Students cannot easily organize videos into a syllabus.
9. Notes and timestamps are disconnected from lectures.
10. Students have difficulty tracking total study time.
11. There is no personal course progression system.
12. Revision becomes difficult.
13. Students do not know which topics are weak.
14. YouTube is optimized for content discovery, not disciplined learning.

FocusLearn addresses these problems. # 3. TARGET EXPERIENCE

A student should be able to:

1. Open FocusLearn.
2. Choose a subject.
3. Choose a chapter.
4. Select a lecture.
5. Watch only that lecture.
6. See no distracting YouTube recommendations around the learning experience.
7. Pause whenever necessary.
8. Take timestamped notes.
9. Bookmark important moments.
10. Resume later from the exact position.
11. Mark the lecture complete.
12. Continue to the next lecture manually.
13. Track study time.
14. Review notes and bookmarks later.
15. See chapter and subject progress.
16. Maintain daily study goals.
17. Use Focus Mode for maximum concentration. # 4. PRODUCT STRUCTURE

The application hierarchy should be:

```text
FocusLearn
│
├── Dashboard
│
├── Subjects
│   │
│   ├── Physics
│   │   ├── Chapter 01
│   │   │   ├── Lecture 01
│   │   │   ├── Lecture 02
│   │   │   └── Lecture 03
│   │   │
│   │   ├── Chapter 02
│   │   └── Chapter 03
│   │
│   ├── Chemistry
│   └── Higher Mathematics
│
├── Continue Learning
├── My Notes
├── Bookmarks
├── Revision
├── Analytics
└── Settings
``` # 5. USER ROLES

## 5.1 Student

Students can:

* View subjects
* View chapters
* Watch lectures
* Track progress
* Create notes
* Create bookmarks
* Set study goals
* Track analytics
* Use Focus Mode
* Mark topics as weak
* Manage personal settings

## 5.2 Admin

Admin can:

* Create subjects
* Edit subjects
* Delete subjects
* Create chapters
* Reorder chapters
* Add lectures
* Import YouTube URLs
* Edit lecture metadata
* Reorder lectures
* Mark lectures as important
* Add resources
* Detect unavailable videos
* Manage curriculum structure

For the initial version, the application may have one administrator account. # 6. CORE USER JOURNEY

## First Visit

```text
Landing Page
      ↓
Sign In
      ↓
Dashboard
      ↓
Choose Subject
      ↓
Choose Chapter
      ↓
Choose Lecture
      ↓
Watch
```

## Returning User

```text
Login
 ↓
Dashboard
 ↓
Continue Learning
 ↓
Resume exact timestamp
``` # 7. AUTHENTICATION

Use Firebase Authentication.

Initial authentication:

* Google Sign-In
* Email/password may be added later

After authentication:

* Create user profile in Firestore.
* Store display name.
* Store email.
* Store profile image URL.
* Store createdAt.
* Store lastLoginAt.
* Store role.

Roles:

```text
student
admin
```

Never trust a frontend-only role flag.

Admin permissions must be protected through Firebase security rules. # 8. DASHBOARD

The Dashboard is the central home screen.

## Header

Display:

```text
Good evening, Nirob 👋

Ready to continue learning?
```

Greeting should dynamically change:

* Good morning
* Good afternoon
* Good evening
* Good night

## Main Dashboard Sections

### A. Continue Learning

Display the most recently watched unfinished lecture.

Example:

```text
Physics
Newtonian Mechanics

Lecture 04 — Friction

72% completed

[ Continue Learning ]
```

Clicking Continue must resume from the stored timestamp. ### B. Today's Study Goal

Example:

```text
Today's Goal

4h 32m / 6h

██████████████░░░░

1h 28m remaining
``` ### C. Current Streak

Example:

```text
🔥 12 Day Streak

Best: 18 days
``` ### D. Subject Progress

Example:

```text
Physics        67%
Chemistry      42%
Higher Math    54%
``` ### E. Recent Activity

Show:

* Last watched lecture
* Recently completed lecture
* Latest bookmark
* Latest note # 9. SUBJECT SYSTEM

Subjects must be fully customizable.

Example:

```text
Physics
Chemistry
Higher Mathematics
Biology
ICT
English
```

Admin can create unlimited subjects.

Subject fields:

```text
id
name
description
icon
coverImage
color/accent
order
createdAt
updatedAt
isActive
``` # 10. CHAPTER SYSTEM

Each subject contains chapters.

Example:

```text
Physics

01. Vector
02. Newtonian Mechanics
03. Work, Energy & Power
04. Gravitation
```

Chapter fields:

```text
id
subjectId
name
description
order
createdAt
updatedAt
isActive
```

Admin can reorder chapters. # 11. LECTURE SYSTEM

Each chapter contains lectures.

Example:

```text
Newtonian Mechanics

01 — Introduction
02 — Newton's First Law
03 — Newton's Second Law
04 — Friction
05 — Circular Motion
```

Lecture fields:

```text
id
chapterId
title
youtubeVideoId
youtubeUrl
thumbnailUrl
duration
channelName
description
order
isImportant
isActive
createdAt
updatedAt
``` # 12. YOUTUBE VIDEO IMPORT

Admin should be able to paste a YouTube URL.

Example:

```text
Paste YouTube URL

[ https://www.youtube.com/watch?v=XXXXXXXX ]

[ Import Video ]
```

The system should:

1. Parse the URL.
2. Extract video ID.
3. Validate the video ID.
4. Retrieve permitted metadata through the appropriate official YouTube API.
5. Verify whether the video can be embedded.
6. Retrieve title.
7. Retrieve thumbnail.
8. Retrieve channel information.
9. Retrieve duration where available.
10. Display a preview.
11. Allow admin confirmation.
12. Save the lecture.

Preview:

```text
┌──────────────────────────────┐
│          THUMBNAIL           │
└──────────────────────────────┘

Physics 1st Paper
Chapter 03 Lecture 04

Channel: Example Academy
Duration: 02:43:17

Embedding: Available

[ Add Lecture ]
```

The system must NOT download the video.

The system must NOT store a video copy.

The system must use the official YouTube embedded player. # 13. YOUTUBE URL SUPPORT

Support common URL formats such as:

```text
youtube.com/watch?v=VIDEO_ID
youtu.be/VIDEO_ID
youtube.com/embed/VIDEO_ID
```

Normalize all supported URLs to a canonical video ID.

Invalid URLs should produce a clear error.

Example:

```text
Invalid YouTube URL.

Please paste a valid YouTube video link.
``` # 14. VIDEO PLAYER EXPERIENCE

This is the most important feature.

The lecture page should feel like a premium LMS rather than YouTube.

## Layout

Desktop:

```text
┌──────────────────────────────────────────────────────┐
│ ← Physics / Newtonian Mechanics                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│                    VIDEO                             │
│                                                      │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Lecture 04 — Friction                                │
│                                                      │
│ ▶        🔊        1.75x       🔖      Notes         │
└──────────────────────────────────────────────────────┘
```

The surrounding FocusLearn interface must not show:

* YouTube homepage
* YouTube Shorts feed
* YouTube recommendations
* Comments
* Search feed
* unrelated videos

Only the selected lecture should be presented in the learning interface. # 15. IMPORTANT YOUTUBE COMPLIANCE REQUIREMENT

FocusLearn must use official YouTube embedding mechanisms.

Do NOT:

* download YouTube videos
* scrape video streams
* rehost videos
* bypass YouTube restrictions
* extract hidden media URLs
* use unofficial video downloading APIs
* replace YouTube's official playback system with a ripped copy

The application should respect YouTube's current API and embedded-player requirements.

If a video cannot legally/technically be embedded, FocusLearn should display:

```text
This lecture cannot currently be embedded.

Please choose another lecture.
```

Never attempt to bypass the restriction. # 16. PLAYER CONTROLS

The application should provide the cleanest possible supported playback experience.

Required functionality:

* Play
* Pause
* Mute/unmute
* Volume
* Playback speed
* Fullscreen
* Seek
* Progress

The application should not attempt to hide or manipulate YouTube functionality through unsupported hacks.

Where supported by the official embedded player/API, use:

```text
0.5x
0.75x
1x
1.25x
1.5x
1.75x
2x
2.5x
3x
``` # 17. REMEMBER PLAYBACK SPEED

Store user's preferred playback speed.

Example:

```text
Preferred speed: 1.75x
```

When another lecture starts:

```text
Automatically start at 1.75x
```

User can change it at any time. # 18. RESUME PLAYBACK

Every lecture should remember the user's position.

Example:

```text
Lecture 04
Last watched: 02:37:42
```

When reopened:

```text
Resume from 02:37:42?

[ Resume ] [ Start From Beginning ]
```

Optionally provide:

```text
Continue automatically
```

in settings. # 19. PROGRESS TRACKING

Track:

```text
currentPosition
totalDuration
percentage
lastWatchedAt
watchSessions
completed
```

Progress percentage:

```text
currentPosition / totalDuration × 100
```

Do not treat a lecture as completed merely because it was opened.

Default completion threshold:

```text
>= 90%
```

Admin/system configuration may adjust this later.

Users must also be able to manually mark a lecture completed. # 20. CHAPTER PROGRESS

Chapter progress should be calculated from lecture completion.

Example:

```text
Newtonian Mechanics

7 / 10 lectures completed

70%
```

Display:

```text
██████████████░░░░░░ 70%
``` # 21. SUBJECT PROGRESS

Subject progress should be calculated from the chapters/lectures beneath it.

Example:

```text
Physics

Completed: 42 / 70 lectures

60%
``` # 22. LECTURE STATUS

Every lecture should visually indicate:

```text
○ Not Started

◐ In Progress

✓ Completed
```

Use accessible icons + text rather than color alone. # 23. TIMESTAMPED NOTES

This is a core feature.

While watching:

```text
[ + Add Note ]
```

When clicked:

```text
Timestamp: 01:42:17

Write your note...

[ Save Note ]
```

Save:

```text
noteId
userId
lectureId
timestamp
content
createdAt
updatedAt
```

Clicking a note should seek the player to that timestamp where supported.

Example:

```text
01:42:17
Important explanation of friction.
```

Click:

```text
→ player jumps to 01:42:17
``` # 24. BOOKMARKS

User can bookmark any moment.

Button:

```text
🔖 Bookmark
```

Example:

```text
01:24:31 — Important Concept

02:17:45 — Exam Question

03:05:12 — Must Revise
```

Bookmark fields:

```text
id
userId
lectureId
timestamp
label
createdAt
``` # 25. IMPORTANT MOMENTS

User can categorize bookmarks.

Categories:

```text
Important
Formula
Exam Question
Confusing
Revision
Example
```

This will make revision much easier. # 26. MY NOTES PAGE

Dedicated page:

```text
My Notes
```

Filters:

```text
All
Physics
Chemistry
Math
```

Each note:

```text
Physics
Newtonian Mechanics

01:42:17

Important explanation...

[ Jump to Lecture ]
```

Search notes by keyword. # 27. BOOKMARKS PAGE

Dedicated page:

```text
My Bookmarks
```

Filter by:

* Subject
* Chapter
* Category
* Lecture

Clicking a bookmark opens the lecture and seeks to the timestamp. # 28. FOCUS MODE

Focus Mode is a primary differentiator.

When activated:

Hide:

* Sidebar
* Navigation
* Subject menus
* Analytics
* Extra UI

Keep only:

```text
Lecture title

Video

Essential player controls

Minimal progress indicator
```

Focus Mode should support fullscreen where browser/player capabilities allow.

Exit:

```text
[ Exit Focus Mode ]
``` # 29. STUDY TIMER

FocusLearn should have an optional study timer.

Modes:

### Custom Timer

User chooses:

```text
30 min
45 min
50 min
60 min
90 min
Custom
```

### Pomodoro

Default:

```text
50 min Study
5 min Break
```

When study session starts:

```text
Focus Session

49:32
```

The timer should not force the user to stop watching unless the user enables automatic pause. # 30. BREAK REMINDER

After configurable continuous study:

```text
You've been studying for 50 minutes.

Give your eyes a short break.

[ Start Break ]
[ Continue Studying ]
```

Default:

```text
Study: 50 minutes
Break: 5 minutes
```

This is a user setting. # 31. DAILY STUDY GOAL

User chooses:

```text
Daily Goal: 6 hours
```

Dashboard:

```text
Today's Progress

4h 32m / 6h

75%
```

When complete:

```text
🎉 Daily Goal Completed
```

Do not make the system overly gamified.

The goal is productivity, not addiction. # 32. STUDY ANALYTICS

Analytics page should include:

### Today

```text
4h 32m
```

### This Week

```text
28h 41m
```

### This Month

```text
112h 18m
```

### Subject Distribution

```text
Physics          42%
Chemistry        25%
Higher Math      33%
```

### Daily Activity

Show a simple weekly chart. # 33. STUDY SESSION MODEL

Each study session should record:

```text
sessionId
userId
lectureId
subjectId
chapterId
startedAt
endedAt
duration
```

Use sessions to calculate analytics.

Do not count idle browser time as actual study time indefinitely.

Implement reasonable activity detection. # 34. STREAK SYSTEM

Track consecutive days where the user reaches a configurable minimum study duration.

Example:

```text
🔥 12 Day Streak
```

Default minimum:

```text
30 minutes/day
```

Allow configuration later. # 35. PERSONAL STUDY PLAN

User can create a study plan.

Example:

```text
Physics

☑ Vector
☑ Newtonian Mechanics
☐ Work Energy Power
☐ Gravitation
```

A plan can contain:

* Subject
* Chapter
* Lecture
* Target date
* Priority
* Status # 36. WEAK TOPICS

Users can mark chapters/topics:

```text
🔴 Weak
🟡 Needs Practice
🟢 Strong
```

Example:

```text
Physics

🔴 Friction
🔴 Circular Motion
🟡 Projectile Motion
🟢 Vector
```

Weak topics should appear on Dashboard. # 37. REVISION MODE

Revision Mode gathers:

* Important bookmarks
* Timestamp notes
* Weak topics
* Incomplete lectures
* Important lectures
* Formula notes

Example:

```text
Newtonian Mechanics — Revision

🔖 04:23
Newton's Second Law

🔖 42:15
Friction

📝 01:24:31
Important example

🔴 Weak Topic
Circular Motion
```

One click should jump to the relevant lecture/timestamp. # 38. IMPORTANT LECTURES

Admin can mark lectures as important.

Users can filter:

```text
⭐ Important Lectures
```

Useful for exam revision. # 39. RESOURCE SYSTEM

Each chapter may contain resources.

Types:

```text
PDF
Image
Formula Sheet
Question Bank
External Resource
Personal Resource
```

The platform must only host files that the administrator/user has the right to store and distribute. # 40. SEARCH

Global search should search:

* Subjects
* Chapters
* Lectures
* Notes
* Bookmarks

Example:

Search:

```text
friction
```

Results:

```text
Physics
Newtonian Mechanics

Lecture 04 — Friction

Note:
"Limiting friction..."

Bookmark:
"Coefficient of friction..."
``` # 41. ADMIN DASHBOARD

Admin homepage:

```text
Admin Dashboard

Subjects: 5
Chapters: 42
Lectures: 384
Broken Videos: 3

Users: 1
``` # 42. ADMIN SUBJECT MANAGEMENT

Admin can:

* Add
* Edit
* Delete
* Reorder
* Activate/deactivate

Subject editor:

```text
Name
Description
Icon
Cover
Order

[ Save ]
``` # 43. ADMIN CHAPTER MANAGEMENT

Inside a subject:

```text
Physics

01. Vector
02. Newtonian Mechanics
03. Work Energy Power

[ + Add Chapter ]
```

Drag-and-drop reordering. # 44. ADMIN LECTURE MANAGEMENT

Inside a chapter:

```text
Lecture 01
Lecture 02
Lecture 03
Lecture 04
```

Actions:

```text
Edit
Move
Duplicate metadata
Delete
Check availability
``` # 45. BROKEN VIDEO MONITORING

Admin dashboard should show:

```text
Video Health

✓ 381 Available
⚠ 3 Unavailable
```

Possible statuses:

```text
available
unavailable
private
not_embeddable
deleted
unknown
```

Never attempt to bypass unavailable/private restrictions. # 46. RESPONSIVE DESIGN

The application must work on:

* Desktop
* Laptop
* Tablet
* Mobile

Desktop:

Sidebar + content.

Mobile:

Bottom navigation or collapsible sidebar.

Video should remain responsive. # 47. MOBILE NAVIGATION

Recommended:

```text
Home
Subjects
Progress
Notes
Profile
```

Keep the interface minimal. # 48. PWA

Prepare the application as a Progressive Web App.

Features:

* Installable
* App icon
* Standalone mode
* Responsive layout
* Basic caching for application shell

Do NOT cache/re-host YouTube videos. # 49. DARK MODE

Default:

Dark/low-distraction theme.

Support:

```text
Dark
Light
System
```

Dark mode should not mean pure black everywhere.

Use a premium layered surface system. # 50. DESIGN SYSTEM

Visual direction:

 Premium + Minimal + Academic + Productivity 

Avoid:

* excessive gradients
* excessive animations
* flashy gamification
* clutter
* unnecessary cards
* huge decorative graphics

Use:

* clean typography
* strong spacing
* subtle borders
* subtle shadows
* restrained accent color
* excellent hierarchy # 51. COLOR SYSTEM

Suggested:

```text
Background:
#0B0F14

Surface:
#111820

Elevated Surface:
#17202A

Primary:
#6366F1

Success:
#22C55E

Warning:
#F59E0B

Danger:
#EF4444

Text:
#F8FAFC

Secondary Text:
#94A3B8
```

Allow theme customization later. # 52. TYPOGRAPHY

Use a highly readable modern font.

Recommended:

```text
Inter
```

For Bengali support:

```text
Noto Sans Bengali
```

The interface must support Bangla and English text correctly. # 53. ANIMATION

Animations must be subtle.

Use:

* fade
* slide
* scale
* progress transitions

Avoid excessive motion.

Provide reduced-motion compatibility where appropriate. # 54. ACCESSIBILITY

Requirements:

* Keyboard navigation
* Visible focus states
* Semantic HTML
* Accessible labels
* Good contrast
* Screen-reader friendly buttons
* Never rely only on color
* Responsive text
* Reduced motion support # 55. FIREBASE ARCHITECTURE

Use:

```text
Firebase Authentication
Cloud Firestore
Firebase Storage
Firebase App Check where appropriate
```

Do not create unnecessary backend complexity for V1. # 56. FIRESTORE DATA MODEL

Recommended structure:

```text
users/{userId}

subjects/{subjectId}

chapters/{chapterId}

lectures/{lectureId}

users/{userId}/progress/{lectureId}

users/{userId}/notes/{noteId}

users/{userId}/bookmarks/{bookmarkId}

users/{userId}/studySessions/{sessionId}

users/{userId}/settings/preferences

users/{userId}/plans/{planId}
``` # 57. USER DOCUMENT

```text
{
  uid,
  displayName,
  email,
  photoURL,
  role,
  createdAt,
  lastLoginAt,
  dailyGoalMinutes,
  streak,
  longestStreak
}
``` # 58. PROGRESS DOCUMENT

```text
{
  lectureId,
  currentPosition,
  duration,
  percentage,
  completed,
  lastWatchedAt,
  totalWatchTime
}
``` # 59. NOTE DOCUMENT

```text
{
  lectureId,
  subjectId,
  chapterId,
  timestamp,
  content,
  category,
  createdAt,
  updatedAt
}
``` # 60. BOOKMARK DOCUMENT

```text
{
  lectureId,
  subjectId,
  chapterId,
  timestamp,
  label,
  category,
  createdAt
}
``` # 61. STUDY SESSION DOCUMENT

```text
{
  lectureId,
  subjectId,
  chapterId,
  startedAt,
  endedAt,
  duration,
  source
}
``` # 62. SECURITY

Firebase Security Rules must enforce:

Students:

* read public curriculum
* read own progress
* write own progress
* read/write own notes
* read/write own bookmarks
* read/write own settings
* read/write own study sessions

Students must NOT:

* modify subjects
* modify chapters
* modify lectures
* modify other users' data
* modify admin configuration

Admin:

* full curriculum management # 63. OFFLINE BEHAVIOR

The app may cache:

* curriculum metadata
* user settings
* recent notes

But should NOT attempt to cache YouTube video streams.

If offline:

```text
You're offline.

Previously loaded course information may still be available, but video playback requires an internet connection.
``` # 64. ERROR HANDLING

Every error must have a human-readable message.

Examples:

### Video unavailable

```text
This lecture is currently unavailable.
```

### Network error

```text
Connection lost.
Please check your internet connection.
```

### Firebase error

```text
We couldn't save your progress.
We'll try again automatically.
```

### Authentication

```text
Sign-in failed.
Please try again.
```

Never expose raw Firebase/API errors to users. # 65. AUTOSAVE

Progress should autosave periodically.

Recommended:

```text
every 10–15 seconds
```

and additionally:

* on pause
* on page visibility change
* before navigation
* when lecture ends

Use debouncing to avoid excessive writes. # 66. FIREBASE COST OPTIMIZATION

Since the goal is to stay within the Firebase free tier as much as reasonably possible:

Avoid writing progress every second.

Bad:

```text
write Firestore every 1 second
```

Good:

```text
local state
↓
periodic batched update
↓
Firestore
```

Use localStorage/session state where appropriate.

Only persist meaningful changes. # 67. LOCAL-FIRST PLAYER STATE

During playback:

```text
Player
 ↓
Local State
 ↓
Periodic Sync
 ↓
Firestore
```

This minimizes database writes.

If the user temporarily loses internet:

```text
Local progress
 ↓
Reconnect
 ↓
Sync
``` # 68. PERFORMANCE

Requirements:

* Fast initial page load
* Lazy load lecture lists
* Lazy load images
* Avoid unnecessary Firebase listeners
* Avoid loading all curriculum data at once
* Code split large pages
* Optimize thumbnails
* Debounce search
* Minimize Firestore reads # 69. SECURITY OF YOUTUBE API KEY

Never expose sensitive server credentials unnecessarily.

If a YouTube API key is used client-side, configure API restrictions appropriately.

Prefer a secure server-side/serverless proxy for operations that require secrets where appropriate.

Do not place privileged credentials inside the frontend repository. # 70. NETLIFY DEPLOYMENT

Deployment target:

```text
Netlify
```

Required:

* Production build
* Environment variables
* SPA routing configuration
* HTTPS
* Preview deployments
* Production deployment

Environment variables should include:

```text
Firebase configuration
YouTube API configuration
```

Do not commit secrets into Git. # 71. PROJECT ARCHITECTURE

Recommended stack:

```text
React
TypeScript
Vite
Tailwind CSS
Firebase
YouTube IFrame Player API
```

Optional:

```text
Lucide Icons
Recharts
React Router
```

Avoid unnecessary libraries. # 72. CODE QUALITY

Claude should produce:

* TypeScript
* Strong typing
* Reusable components
* Clear folder structure
* No duplicated logic
* No giant monolithic components
* Proper error handling
* Environment-based configuration # 73. RECOMMENDED FOLDER STRUCTURE

```text
src/

components/
  layout/
  dashboard/
  video/
  notes/
  bookmarks/
  analytics/
  common/

pages/
  Dashboard
  Subjects
  Chapter
  Lecture
  Notes
  Bookmarks
  Analytics
  Settings
  Admin

hooks/
  useAuth
  useProgress
  useYouTubePlayer
  useNotes
  useBookmarks
  useStudyTimer

services/
  firebase
  youtube
  analytics

types/

utils/

contexts/

styles/
``` # 74. VIDEO PAGE COMPONENT STRUCTURE

```text
LecturePage
│
├── Breadcrumb
├── LectureHeader
├── VideoPlayer
├── PlayerActions
│   ├── Bookmark
│   ├── Note
│   ├── Focus Mode
│   └── Speed
│
├── ProgressBar
│
├── NotesPanel
├── BookmarkPanel
│
└── NextLectureCard
``` # 75. LECTURE PAGE UX

At the top:

```text
Physics
/
Newtonian Mechanics

Lecture 04 — Friction
```

Video.

Below video:

```text
72% completed

[ 🔖 Bookmark ] [ 📝 Add Note ] [ 🎯 Focus Mode ]
```

Then:

```text
Notes
Bookmarks
Overview
```

Tabs can be used on desktop. # 76. NO AUTOPLAY RABBIT HOLE

After lecture completion:

```text
✓ Lecture Completed

Next Lecture

Lecture 05 — Circular Motion

[ Continue ]
```

Do NOT automatically send users into another content feed.

The student explicitly chooses what to watch next. # 77. NEXT/PREVIOUS NAVIGATION

Within a chapter:

```text
← Previous Lecture

Lecture 04

Next Lecture →
```

The navigation should remain inside the current chapter.

No random recommendation system. # 78. BREADCRUMBS

Always show context:

```text
HSC 2027
→ Physics
→ Newtonian Mechanics
→ Lecture 04
```

This prevents the user from getting lost. # 79. PERSONALIZATION

User preferences:

```text
Default playback speed
Daily study goal
Preferred theme
Focus mode default
Break reminder
Automatic resume
Reduced motion
``` # 80. SETTINGS PAGE

Sections:

### Account

* Name
* Email
* Profile

### Study

* Daily goal
* Default playback speed
* Break reminder
* Auto resume

### Appearance

* Dark
* Light
* System

### Focus

* Focus Mode defaults
* Hide unnecessary UI # 81. SEARCH UX

Global search shortcut:

```text
Ctrl + K
```

Search overlay:

```text
Search lectures, chapters, subjects, notes...

Physics
  Newtonian Mechanics
  Lecture 04 — Friction

Notes
  "Coefficient of friction..."
``` # 82. KEYBOARD SHORTCUTS

Where technically supported:

```text
Space     Play/Pause
←         Seek backward
→         Seek forward
M         Mute
F         Fullscreen
B         Bookmark
N         Next lecture
P         Previous lecture
Ctrl+K    Search
Esc       Close modal / exit focus interface
```

Do not override browser/system shortcuts unnecessarily. # 83. MOBILE EXPERIENCE

Mobile lecture page:

```text
← Physics

VIDEO

Lecture 04 — Friction

72%

[Bookmark]
[Note]
[Focus]

Notes
Bookmarks
```

Bottom navigation:

```text
Home
Subjects
Progress
Notes
Profile
``` # 84. EMPTY STATES

Never show blank screens.

Example:

### No Notes

```text
📝 No notes yet

Take your first note while watching a lecture.
```

### No Bookmarks

```text
🔖 No bookmarks yet

Save important moments for revision.
```

### No Progress

```text
Start your first lecture.
Your learning journey will appear here.
``` # 85. LOADING STATES

Use skeleton loaders instead of blank pages.

Examples:

```text
Subject Card Skeleton
Lecture Card Skeleton
Dashboard Skeleton
``` # 86. TOAST NOTIFICATIONS

Examples:

```text
✓ Progress saved
✓ Bookmark added
✓ Note saved
✓ Lecture completed
✓ Daily goal completed
```

Errors:

```text
⚠ Unable to save. Retrying...
``` # 87. CONFIRMATION SYSTEM

Destructive actions require confirmation.

Example:

```text
Delete Lecture?

This will remove the lecture from your curriculum.

[ Cancel ] [ Delete ]
```

Never use browser `alert()` for normal UI. # 88. ADMIN VIDEO IMPORT FLOW

Detailed flow:

```text
Admin
 ↓
Select Subject
 ↓
Select Chapter
 ↓
Add Lecture
 ↓
Paste YouTube URL
 ↓
Extract Video ID
 ↓
Validate
 ↓
Fetch metadata
 ↓
Check embeddability
 ↓
Preview
 ↓
Confirm
 ↓
Save
``` # 89. ADMIN DRAG-AND-DROP

Allow reordering:

```text
☰ Lecture 01
☰ Lecture 02
☰ Lecture 03
☰ Lecture 04
```

Order should persist in Firestore. # 90. BULK IMPORT — FUTURE

Future version may support:

```text
CSV

Subject
Chapter
Lecture Title
YouTube URL
Order
```

Admin can import multiple lectures.

Do not make this mandatory for V1. # 91. DATA VALIDATION

Validate:

* YouTube URL
* Video ID
* Required titles
* Subject IDs
* Chapter IDs
* Numeric timestamps
* Study duration
* User permissions

Never trust client-provided IDs blindly. # 92. ANALYTICS PRIVACY

Analytics are personal.

Users should only see their own:

* study time
* progress
* notes
* bookmarks
* streaks
* activity

No public leaderboard in V1. # 93. ANTI-DISTRACTION DESIGN PRINCIPLES

The application must NEVER become another social media platform.

Do not add:

* public feed
* comments
* likes
* followers
* creator profiles
* trending content
* endless recommendations
* Shorts-like vertical feed
* notification spam

The product is intentionally boring in the best possible way.

Its job is to help the student study. # 94. MVP FEATURE SET

V1 must include:

```text
✓ Firebase Authentication
✓ Dashboard
✓ Subjects
✓ Chapters
✓ Lectures
✓ YouTube URL import
✓ Embeddability validation
✓ Official embedded player
✓ Playback progress
✓ Resume
✓ Speed
✓ Completion tracking
✓ Notes
✓ Timestamp notes
✓ Bookmarks
✓ Focus Mode
✓ Daily study goal
✓ Study timer
✓ Basic analytics
✓ Admin panel
✓ Responsive design
✓ Dark mode
✓ Netlify deployment
``` # 95. V2 FEATURES

After V1 is stable:

```text
• Revision Mode
• Weak Topic System
• Advanced analytics
• Study plans
• PDF resources
• Advanced search
• Bulk lecture import
• Better admin tools
• PWA enhancements
• Offline metadata
• More advanced keyboard controls
``` # 96. V3 / FUTURE FEATURES

Potential future:

```text
• AI study assistant
• AI-generated quiz from user-provided notes
• AI revision planner
• AI weak-topic analysis
• Automatic chapter summaries
• Flashcards
• Exam countdown
• HSC syllabus tracking
• University admission preparation mode
```

AI features must be added carefully and should not turn the platform into another distraction. # 97. EXAM MODE — FUTURE

Allow the student to set:

```text
HSC Exam:
May 2027
```

Dashboard:

```text
🔥 263 Days Remaining

Syllabus Completion
██████████░░░ 68%

Study Target
6h/day
```

This is especially useful for long-term exam preparation. # 98. COURSE COMPLETION

Show:

```text
Physics

42 / 70 Lectures

60%

Estimated remaining:
28h 40m
```

Estimated remaining time can be calculated from remaining lecture duration. # 99. SMART STUDY RECOMMENDATION

Do NOT build an addictive recommendation engine.

Instead create a deterministic study queue:

```text
Continue current lecture
↓
Finish current chapter
↓
Study weak topic
↓
Next planned lecture
```

This keeps the user focused. # 100. “WHAT SHOULD I STUDY NOW?” BUTTON

Dashboard:

```text
🎯 What should I study now?
```

The system chooses based on:

1. unfinished lecture
2. current study plan
3. weak topic
4. upcoming target
5. chapter progression

It should not recommend random content. # 101. DESIGN LANGUAGE

The interface should feel like a combination of:

* Premium LMS
* Notion-like organization
* Modern productivity software
* Minimal academic dashboard

But do not directly clone another company's interface.

Create an original visual identity. # 102. BRAND PERSONALITY

FocusLearn should feel:

* Calm
* Focused
* Intelligent
* Premium
* Academic
* Minimal
* Reliable

Not:

* childish
* noisy
* social-media-like
* overly gamified # 103. PERFORMANCE TARGETS

Aim for:

```text
Fast initial load
Fast navigation
Minimal layout shift
Responsive interaction
Smooth video page transitions
Low Firestore read/write overhead
```

Do not optimize prematurely at the expense of maintainability. # 104. DEVELOPMENT PRINCIPLE

Claude Sonnet must NOT attempt to build the entire application in one giant implementation.

Build incrementally.

Recommended sequence:

```text
Phase 1
Project foundation

Phase 2
Authentication

Phase 3
Curriculum system

Phase 4
YouTube integration

Phase 5
Progress tracking

Phase 6
Notes + bookmarks

Phase 7
Dashboard + analytics

Phase 8
Focus Mode + timer

Phase 9
Admin panel

Phase 10
Security + optimization

Phase 11
Testing

Phase 12
Deployment
``` # 105. PHASE 1 — FOUNDATION

Implement:

* React
* TypeScript
* Vite
* Tailwind
* Router
* Firebase initialization
* Design system
* Layout
* Responsive navigation
* Theme

Before moving forward:

```text
npm run build
```

must succeed. # 106. PHASE 2 — AUTH

Implement:

* Firebase Google Auth
* Protected routes
* User document
* Role handling
* Logout
* Profile

Test:

```text
Login
Logout
Refresh
Protected route
``` # 107. PHASE 3 — CURRICULUM

Implement:

```text
Subjects
Chapters
Lectures
```

Admin CRUD.

Student read-only curriculum. # 108. PHASE 4 — YOUTUBE

Implement:

* URL parser
* Video ID extraction
* Official API metadata
* Embeddability validation
* Official embedded player
* Player state synchronization

Test:

```text
Valid video
Invalid video
Private video
Unavailable video
Non-embeddable video
Different URL formats
``` # 109. PHASE 5 — PROGRESS

Implement:

* current position
* percentage
* completion
* resume
* last watched
* chapter progress
* subject progress

Optimize Firestore writes. # 110. PHASE 6 — NOTES & BOOKMARKS

Implement:

* timestamp note
* bookmark
* categories
* search
* jump-to-timestamp # 111. PHASE 7 — DASHBOARD

Implement:

* continue learning
* daily goal
* progress
* study time
* streak
* recent activity # 112. PHASE 8 — FOCUS

Implement:

* Focus Mode
* Study Timer
* Pomodoro
* Break Reminder
* Eye Break
* Keyboard shortcuts # 113. PHASE 9 — ADMIN

Implement:

* Subject management
* Chapter management
* Lecture management
* YouTube import
* Drag reorder
* Broken video status # 114. PHASE 10 — SECURITY

Review:

* Firebase rules
* Role permissions
* API security
* Environment variables
* XSS prevention
* input validation
* Firestore access # 115. PHASE 11 — TESTING

Test:

### Authentication

* Login
* Logout
* Unauthorized access

### Curriculum

* Add
* Edit
* Delete
* Reorder

### Video

* Play
* Pause
* Speed
* Resume
* unavailable video

### Progress

* Save
* Reload
* Resume

### Notes

* Add
* Edit
* Delete
* Jump timestamp

### Bookmarks

* Add
* Delete
* Jump timestamp

### Analytics

* Study session
* Daily total
* Weekly total

### Responsive

* Mobile
* Tablet
* Desktop # 116. PHASE 12 — DEPLOYMENT

Deploy to Netlify.

Production checklist:

```text
✓ Environment variables
✓ Firebase configuration
✓ Firestore rules
✓ Authentication domains
✓ Netlify redirects
✓ HTTPS
✓ Production build
✓ Error handling
✓ Mobile testing
``` # 117. ACCEPTANCE CRITERIA

The product is considered V1 complete when:

1. A student can log in.
2. Student sees personalized dashboard.
3. Admin can create subjects.
4. Admin can create chapters.
5. Admin can add YouTube lectures.
6. System validates embeddability.
7. Student can watch lecture using official embed.
8. Student can change playback speed where supported.
9. Student can pause/play/mute.
10. Student can resume later.
11. Progress is saved.
12. Lecture completion works.
13. Chapter progress works.
14. Subject progress works.
15. Student can create timestamp notes.
16. Student can create bookmarks.
17. Timestamp navigation works.
18. Focus Mode works.
19. Daily goal works.
20. Study time is recorded.
21. Dashboard analytics work.
22. Firebase security rules prevent unauthorized modification.
23. Application is responsive.
24. Application deploys successfully to Netlify.
25. No YouTube video is downloaded or re-hosted. # 118. NON-GOALS

FocusLearn is NOT:

* a YouTube clone
* a video hosting platform
* a social network
* a video downloader
* a content piracy system
* a public course marketplace
* a recommendation feed # 119. MOST IMPORTANT PRODUCT RULE

If a feature increases engagement but decreases concentration, reject it.

If a feature makes studying easier, faster, more organized, or more measurable, consider it.

The product should optimize:

```text
Focus
+
Consistency
+
Organization
+
Progress
+
Revision
```

not:

```text
Time spent inside the app
``` # 120. FINAL PRODUCT EXPERIENCE

The ideal user experience is:

```text
Open FocusLearn
      ↓
See today's goal
      ↓
Continue Physics
      ↓
Resume exactly where you stopped
      ↓
Watch without YouTube browsing distractions
      ↓
Take timestamped notes
      ↓
Bookmark important moments
      ↓
Complete lecture
      ↓
Return to dashboard
      ↓
See progress increase
      ↓
Take a short break
      ↓
Continue planned study
```

The application should feel like:

>  “I opened this website to study, and everything here helps me study.” 

That is the core identity of FocusLearn. # 121. MASTER DEVELOPMENT INSTRUCTION FOR CLAUDE

Claude Sonnet should treat this PRD as the source of truth.

Before implementing any feature:

1. Understand the existing architecture.
2. Inspect current files.
3. Do not unnecessarily rewrite working code.
4. Follow the existing design system.
5. Use TypeScript.
6. Create reusable components.
7. Keep Firebase reads/writes efficient.
8. Never hardcode secrets.
9. Never use unofficial YouTube downloading/extraction methods.
10. Never bypass YouTube embedding restrictions.
11. Use official YouTube embedding/API mechanisms.
12. Implement one phase at a time.
13. Test after each phase.
14. Fix errors before proceeding.
15. Keep the application production-ready.
16. Do not add unrequested social-media-like features.
17. Prioritize accessibility and mobile responsiveness.
18. Preserve user data.
19. Handle network/API failures gracefully.
20. Explain architectural decisions when they materially affect future development.

When a requirement conflicts with a platform/API restriction, do NOT bypass the restriction. Instead, implement the closest compliant experience and clearly explain the limitation. # 122. DEFINITION OF SUCCESS

FocusLearn succeeds if a student can study a 6-hour YouTube course over several days while:

* never needing to browse YouTube,
* never losing their position,
* knowing exactly what they completed,
* saving important moments,
* maintaining notes,
* tracking study time,
* following a syllabus,
* identifying weak topics,
* revising efficiently,
* and staying focused.

The platform should turn:

 “I have a huge YouTube playlist and don't know where to start.” 

into:

 “I know exactly what I need to study next.”  # END OF MASTER PRD

FocusLearn is intentionally designed as a  personal, distraction-free learning environment , not as another content-consumption platform.
