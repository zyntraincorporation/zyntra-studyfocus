# ZyntraFocus — Premium Personal LMS
## Product Requirements Document (PRD)
**Product:** ZyntraFocus  
**Feature:** Scheduled Live Learning System  
**Document Version:** 1.0  
**Status:** Product Requirements — Ready for Architecture & Implementation Planning  
**Primary Platform:** Web (Desktop & Mobile Responsive)  
**Default Timezone:** Asia/Dhaka (Bangladesh)  

---

# 1. Product Vision

## 1.1 Background

ZyntraFocus বর্তমানে একটি Distraction-Free Learning Platform, যেখানে YouTube Video Link-এর মাধ্যমে Recorded Lectures যুক্ত করা যায় এবং নিজস্ব Video Player দিয়ে সেগুলো দেখা যায়।

বর্তমানে Player-এ রয়েছে:

- Play/Pause
- Playback Speed
- Video Quality
- Timestamp Navigation
- Auto Resume
- Saved Progress
- Slides এবং অন্যান্য Learning Resources
- অন্যান্য Custom Player Controls

কিন্তু Recorded Classes-এর ক্ষেত্রে একটি বড় সমস্যা হচ্ছে Learning Discipline বজায় রাখা।

একজন শিক্ষার্থী ইচ্ছামতো ক্লাস Pause করতে পারে, পরবর্তীতে আবার দেখতে পারে, একাধিক দিন ধরে একই ক্লাস অসম্পূর্ণ রেখে দিতে পারে। ফলে একটি নির্দিষ্ট Study Routine বজায় রাখা কঠিন হয়।

এই সমস্যার সমাধান হিসেবে ZyntraFocus-কে একটি Scheduled Live Learning System-এ রূপান্তর করা হবে।

## 1.2 Product Vision

একটি সম্পূর্ণ Recorded Lecture Library-কে এমন একটি Scheduled Live Class Experience-এ রূপান্তর করা, যেখানে:

1. শিক্ষার্থী আগে থেকেই নিজের সম্পূর্ণ Class Schedule তৈরি করবে।
2. Schedule একবার Final Lock করলে সেটি পরিবর্তন করতে পারবে না।
3. Schedule করা Lecture নির্ধারিত সময়ের আগে সাধারণ Recorded Mode-এ Access করা যাবে না।
4. নির্ধারিত সময় অনুযায়ী Recorded Video স্বয়ংক্রিয়ভাবে Live Timeline অনুসরণ করবে।
5. শিক্ষার্থী Pause করতে পারবে, কিন্তু Schedule Timeline থামবে না।
6. LIVE Button চাপলে বর্তমান সময়ের সঙ্গে ভিডিও Synchronize হবে।
7. নির্ধারিত সময় শেষ হলে Recorded Mode স্বয়ংক্রিয়ভাবে Restore হবে।
8. Existing Slides, Timestamps, Notes, Bookmarks এবং Learning Resources অক্ষত থাকবে।

### Core Philosophy

**Schedule First → Attend Live → Unlock Recording → Review Everything.**

এটি কোনো প্রকৃত Teacher-to-Student Livestream Platform নয়। এটি একটি Personal Scheduled Learning Management System, যেখানে বিদ্যমান Recorded Videos নির্দিষ্ট সময়সূচি অনুযায়ী Broadcast-Style Player-এ উপস্থাপিত হবে।

---

# 2. Product Goals

এই Product-এর প্রধান লক্ষ্য:

### G1. Learning Discipline

শিক্ষার্থী যেন আগে থেকে নির্ধারিত Routine অনুসরণ করে ক্লাস করতে বাধ্য হয়।

### G2. Schedule Commitment

একবার Schedule Lock করলে সেটি আর সাধারণভাবে Edit, Delete, Cancel বা Reschedule করতে পারবে না।

### G3. Controlled Recorded Access

Scheduled Lecture নির্ধারিত Class End Time-এর আগে Recorded Mode-এ খোলা যাবে না।

### G4. Real-Time Learning Experience

Recorded Video-কে নির্ধারিত Start Time এবং End Time অনুযায়ী Live Experience হিসেবে দেখানো।

### G5. Resource Preservation

Class End হলে পুরোনো Recorded Learning Experience সম্পূর্ণভাবে Restore করা।

### G6. Premium LMS Experience

একটি সুন্দর, Lightweight, Responsive এবং Distraction-Free LMS Interface তৈরি করা।

---

# 3. Existing System & Architecture Baseline

বর্তমান Project Feasibility Report অনুযায়ী ZyntraFocus-এর Architecture:

| Layer | Existing Technology |
|---|---|
| Frontend | React 19 |
| Language | TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router DOM v7 |
| Database | Firebase Cloud Firestore |
| Authentication | Firebase Authentication |
| Serverless Backend | Netlify Functions |
| Video Player | YouTube IFrame Player API |
| Existing Player | WatchPage.tsx |
| Main Dashboard | DashboardPage.tsx |
| Session Management | sessions.service.ts |

বর্তমান Database Model:

`users/{userId}/{subcollection}/{documentId}`

Existing Subcollections:

- subjects
- chapters
- lectures
- progress
- notes
- bookmarks
- studySessions
- settings
- studyMaterials

### Architecture Preservation Policy

নতুন LMS Feature বিদ্যমান Architecture-এর ওপর Extension হিসেবে তৈরি করতে হবে।

- Existing Authentication পরিবর্তন করা যাবে না, প্রয়োজন না হলে।
- Existing Recorded Player-এর Features নষ্ট করা যাবে না।
- Existing Lecture Data Migration ছাড়া Delete বা Overwrite করা যাবে না।
- Existing Timestamps, Slides এবং Notes পুনরায় তৈরি করা যাবে না।
- অপ্রয়োজনীয় নতুন Framework বা Heavy Dependencies যোগ করা যাবে না।
- Existing Firebase এবং Netlify Architecture যতটা সম্ভব Reuse করতে হবে।

কোনো নতুন Implementation-এর আগে Actual Source Code পুনরায় পরীক্ষা করে এই Baseline যাচাই করতে হবে।

---

# 4. Product Scope

## 4.1 Core Modules

এই Feature-এ নিচের Modules থাকবে:

1. Schedule Builder
2. Schedule Locking System
3. Upcoming Classes Dashboard
4. Full Timetable / Schedule Page
5. Pre-Class Waiting Room
6. Scheduled Live Player
7. Live Synchronization Engine
8. Recorded Access Protection
9. Post-Class Automatic Restoration
10. Attendance & Study Analytics
11. Class History
12. Notification & Reminder System

## 4.2 Out of Scope

প্রথম Version-এ প্রয়োজন নেই:

- Actual Camera/Microphone Livestream
- Teacher-to-Student Broadcasting
- Public Classroom
- Live Chat
- Multiplayer Classroom
- External Streaming Server
- Live Quiz System
- Unnecessary Social Features

এটি প্রথমে Single-User Personal LMS হিসেবে তৈরি হবে এবং বর্তমান Personal Workspace Model বজায় রাখবে।

---

# 5. Schedule Management System

## 5.1 Schedule Creation

একটি আলাদা Schedule Management Interface থাকবে।

এখানে বিদ্যমান Recorded Lecture Library থেকে Lecture নির্বাচন করা যাবে।

প্রতিটি Schedule-এর জন্য প্রয়োজনীয় তথ্য:

| Field | Description |
|---|---|
| Lecture ID | Existing Lecture Reference |
| Subject | Existing Subject |
| Chapter | Existing Chapter |
| Class Title | Existing Lecture Title |
| Thumbnail | Existing YouTube Thumbnail |
| Video ID | Existing YouTube Video ID |
| Duration | Verified Video Duration |
| Scheduled Date | Class Date |
| Starting Time | Class Start Time |
| Ending Time | Calculated End Time |
| Timezone | Asia/Dhaka |

Ending Time স্বয়ংক্রিয়ভাবে Calculate করতে হবে:

`Ending Time = Starting Time + Verified Video Duration`

উদাহরণ:

- Lecture: Physics — Vector 01
- Duration: 01:30:00
- Date: 5 November 2026
- Start: 6:00 PM
- End: 7:30 PM

Ending Time Manualভাবে পরিবর্তন করা যাবে না।

ভিডিওর YouTube Duration এবং Existing Lecture Metadata যাচাই না করে Schedule Finalize করা যাবে না।

## 5.2 Draft Schedule

Schedule তৈরির সময় সবকিছু প্রথমে Draft হিসেবে থাকবে।

Draft অবস্থায়:

- Lecture পরিবর্তন করা যাবে।
- Date পরিবর্তন করা যাবে।
- Starting Time পরিবর্তন করা যাবে।
- Schedule Preview করা যাবে।
- ভুল Schedule Remove করা যাবে।

Draft অবস্থায় কোনো Recorded Lecture Lock হবে না।

## 5.3 Final Schedule Lock

সবকিছু যাচাই করার পর একটি Primary Action থাকবে:

`LOCK ROUTINE`

এটি Confirmation Step-এর পর Execute হবে।

একবার সফলভাবে Lock হলে:

- Schedule Immutable হবে।
- Edit Disabled হবে।
- Delete Disabled হবে।
- Reschedule Disabled হবে।
- Cancel Disabled হবে।
- Scheduled Lecture Recorded Library থেকে Hide হবে।
- Recorded Route Access Block হবে।
- Upcoming Schedule-এ প্রদর্শিত হবে।

Locked Schedule-এর Document-Level Security-ও নিশ্চিত করতে হবে।

শুধু Frontend Button Hide করে Schedule Lock কার্যকর হয়েছে বলে বিবেচনা করা যাবে না।

### Important Lock Policy

Schedule-এর Lock Permanent থাকবে।

অর্থাৎ নির্ধারিত Class End Time অতিক্রম করার পরেও পুরোনো Schedule Document পরিবর্তনযোগ্য হবে না।

তবে Recorded Access Lock স্বয়ংক্রিয়ভাবে Expire হবে।

এখানে দুটি বিষয় আলাদা:

- **Schedule Lock:** স্থায়ী এবং Immutable।
- **Recorded Access Lock:** নির্ধারিত End Time পর্যন্ত কার্যকর।

## 5.4 Schedule Validation

Lock করার আগে নিচের Validation আবশ্যক:

1. একই Lecture-এর একাধিক Active Schedule থাকবে না।
2. একই User-এর দুইটি Class-এর সময় Overlap করা যাবে না।
3. Scheduled Date Past Date হতে পারবে না।
4. Starting Time ভবিষ্যতের হতে হবে।
5. YouTube Video Accessible এবং Embeddable হতে হবে।
6. Verified Video Duration শূন্য বা Invalid হতে পারবে না।
7. Schedule Date এবং Time সঠিকভাবে Convert হতে হবে।
8. Batch Schedule-এ প্রতিটি Lecture-এর Validity যাচাই করতে হবে।

আগে Scheduled Lecture End হয়ে গেলে ভবিষ্যতে একই Lecture পুনরায় Schedule করার সুযোগ রাখা যেতে পারে। তবে পুরোনো Schedule Record কখনো পরিবর্তন বা Reuse করা যাবে না। প্রতিটি নতুন Schedule-এর আলাদা ID থাকবে।

Recurring Schedule প্রথম Version-এ প্রয়োজন নেই।

---

# 6. Schedule Lifecycle

প্রতিটি Scheduled Class-এর Lifecycle:

`DRAFT → UPCOMING → LIVE → ENDED`

### DRAFT

Schedule এখনো Final Lock হয়নি।

### UPCOMING

Schedule Locked এবং Start Time এখনো আসেনি।

### LIVE

বর্তমান Server Time Start Time এবং End Time-এর মধ্যে রয়েছে।

### ENDED

বর্তমান Server Time End Time অতিক্রম করেছে।

Status কোনো নির্দিষ্ট Browser Tab-এর ওপর নির্ভর করবে না।

Class Status নির্ধারণের মূল ভিত্তি হবে Schedule-এর Immutable `startAt`, `endAt` এবং Reliable Current Time।

### Status Calculation

`now < startAt` → UPCOMING

`startAt <= now < endAt` → LIVE

`now >= endAt` → ENDED

এই Logic Browser Refresh, Device Change এবং Browser Closed থাকা অবস্থাতেও একই ফল দিতে হবে।

Database-এ Status আলাদা করে সংরক্ষণ করলে সেটিকে Derived Status-এর বিকল্প হিসেবে ব্যবহার করা যাবে না। UI সবসময় নির্ভরযোগ্য সময় ও Schedule Data দিয়ে প্রকৃত Status যাচাই করবে।

---

# 7. Recorded Class Locking System

## 7.1 Core Requirement

এটি পুরো LMS-এর সবচেয়ে গুরুত্বপূর্ণ Business Rule।

যে Lecture Schedule করে Lock করা হবে, সেটি Scheduled Class End না হওয়া পর্যন্ত Recorded Mode-এ Access করা যাবে না।

উদাহরণ:

আমার Recorded Library-তে ২০টি Lecture রয়েছে।

আমি ৭টি Lecture Schedule করলাম।

`LOCK ROUTINE` করার পর:

- ৭টি Lecture Recorded Library থেকে Hide হবে।
- বাকি ১৩টি Lecture Normal Recorded Mode-এ থাকবে।
- ৭টি Lecture Upcoming Schedule-এ দেখা যাবে।

## 7.2 Recorded Access Restrictions

Scheduled Lecture নিচের সব Recorded Entry Point থেকে Hide/Block করতে হবে:

- Subject Lecture List
- Chapter Lecture List
- Recorded Library
- Search Results
- Recently Viewed
- Related Lecture Sections
- Direct Recorded Watch Route
- অন্য কোনো Existing Lecture Navigation Entry Point

Direct URL ব্যবহার করেও Recorded Mode Access করা যাবে না।

## 7.3 Full Access Gating

Access Control শুধু UI Layer-এ সীমাবদ্ধ থাকবে না।

নিচের সব বিষয় যাচাই করতে হবে:

- Route Guard
- Data Service
- Firestore Read Rules
- Existing Lecture Query
- Existing Progress/Resource Access
- Direct URL Navigation

Locked Lecture-এর Recorded Data বা Resources Recorded Mode দিয়ে Access করার চেষ্টা করলে Application নিরাপদভাবে Block করবে।

তবে Scheduled Live Player-এর জন্য প্রয়োজনীয় Minimum Data আলাদা Schedule Reference/Snapshot থেকে ব্যবহার করা যাবে।

একই Lecture-এর Schedule Metadata এবং Original Lecture Data-এর মধ্যে Consistency বজায় রাখতে হবে।

## 7.4 Access Unlock

`now >= endAt` হলেই Recorded Access স্বয়ংক্রিয়ভাবে Restore হবে।

এর জন্য Browser Open থাকা, কোনো Button চাপা বা Background Scheduler সফলভাবে চলা বাধ্যতামূলক করা যাবে না।

যে মুহূর্তে সময়সীমা শেষ হবে, Recorded Route এবং Data Access পুনরায় অনুমোদিত হবে।

---

# 8. Dashboard — Premium Upcoming Classes Experience

Dashboard-এর সবচেয়ে গুরুত্বপূর্ণ অংশ হবে Upcoming Classes।

## 8.1 Top Section: Next Three Classes

Dashboard-এর উপরের দিকে পরবর্তী ৩টি Scheduled Class Thumbnail Card আকারে দেখাতে হবে।

প্রতিটি Card-এ থাকবে:

- Video Thumbnail
- Lecture Title
- Subject Name
- Chapter Name
- Scheduled Date
- Starting Time
- Duration
- Class Status
- Countdown অথবা Join Action

Card Status:

- UPCOMING
- LIVE NOW
- ENDED / REVIEW

যদি কোনো Class বর্তমানে Live থাকে, সেটি সবার আগে Priority পাবে।

পরবর্তী তিনটি Class Chronological Order-এ প্রদর্শিত হবে।

## 8.2 Today's Classes

Next Three Section-এর নিচে Today's Classes দেখানো হবে।

এখানে আজকের সব Scheduled Class সময় অনুযায়ী সাজানো থাকবে।

## 8.3 Complete Schedule Preview

Dashboard-এর নিচের দিকে Upcoming Schedule-এর একটি Compact List থাকবে।

একটি `View Full Schedule` Action দিয়ে সম্পূর্ণ Schedule Page-এ যাওয়া যাবে।

Dashboard-এ অপ্রয়োজনীয় Analytics Widget বা Decorative Components যুক্ত করা যাবে না।

---

# 9. Full Schedule Page

একটি পৃথক `/schedule` Page থাকবে।

এটি সম্পূর্ণ Timetable দেখানোর জায়গা।

## 9.1 Schedule Sections

- Today
- Tomorrow
- Upcoming
- Completed / History

প্রতিটি Class Card বা List Item-এ:

- Thumbnail
- Class Title
- Subject
- Scheduled Date
- Start Time
- End Time
- Duration
- Current Status

## 9.2 Calendar View

একটি Lightweight Weekly Timetable View রাখা যেতে পারে।

এখানে প্রতিদিন কোন সময়ে কোন ক্লাস আছে তা দেখা যাবে।

Calendar View যেন অত্যধিক Complex বা Heavy না হয়।

## 9.3 Completed Classes

সব Class End হওয়ার পরে একটি History Section-এ থাকবে।

এখান থেকে `Review Class` Action দিয়ে Original Recorded Lecture খোলা যাবে।

## 9.4 Editing Restrictions

Locked Schedule-এর কোনো Edit, Delete, Cancel বা Reschedule Control দেখানো হবে না।

History থেকেও পুরোনো Schedule পরিবর্তন করা যাবে না।

---

# 10. Pre-Class Waiting Room

Scheduled Class শুরু হওয়ার আগে একটি Waiting Room Experience থাকবে।

উদাহরণ:

Class: Physics — Vector 01

Schedule:
5 November, 6:00 PM

যদি শিক্ষার্থী 5:55 PM-এ Join করে:

তাহলে তাকে একটি Waiting Room দেখাতে হবে।

Waiting Room-এ:

- Class Thumbnail
- Lecture Title
- Subject/Chapter
- Scheduled Starting Time
- Ending Time
- Countdown Timer
- Class Status
- Join/Waiting State

Start Time হওয়ার আগে Video Playback শুরু হবে না।

Countdown Scheduled Start Time-এর সঙ্গে Synchronize থাকবে।

Class শুরু হলে Live Player-এ প্রবেশের ব্যবস্থা হবে।

Browser Autoplay Restriction অনুযায়ী User Interaction প্রয়োজন হলে পরিষ্কারভাবে Audio Enable করতে বলতে হবে।

---

# 11. Scheduled Live Player

এটি LMS-এর সবচেয়ে গুরুত্বপূর্ণ Interface।

বর্তমান `WatchPage.tsx`-এর Video Player Architecture যথাসম্ভব Reuse করে একটি Dedicated Live Player Experience তৈরি করতে হবে।

প্রয়োজনে আলাদা `LiveWatchPage.tsx` তৈরি করা যেতে পারে।

Route:

`/live/:scheduleId`

## 11.1 Player Requirements

Live Player-এ থাকবে:

- Existing YouTube IFrame Player
- Custom Player Overlay
- Play/Pause
- LIVE Button
- Live Status Indicator
- Behind Live Indicator
- Video Quality Control, যদি বিদ্যমান Player/API থেকে সম্ভব হয়
- Buffering Indicator
- Loading State
- Connection Recovery State
- Class Title এবং Schedule Details

## 11.2 Restricted Controls

Live Mode-এ:

- Playback Speed সবসময় 1x।
- Speed Selector থাকবে না।
- Seek Bar Drag করা যাবে না।
- Forward/Backward Skip থাকবে না।
- Keyboard Seek Shortcut Disabled থাকবে।
- Space-hold 2x Playback Disabled থাকবে।
- Timestamp Navigation Disabled থাকবে।
- Recorded Resume Dialog দেখানো যাবে না।

Live Mode-এ Existing Recorded Slides এবং Timestamp Navigation ব্যবহার করা যাবে না।

তবে মূল Lecture Data কোনোভাবেই Delete বা Modify করা যাবে না।

Quality Control রাখা যাবে, কারণ Quality পরিবর্তন করে Video Timeline পরিবর্তনের প্রয়োজন নেই।

YouTube IFrame Player API-এর বাস্তব সীমাবদ্ধতা অনুযায়ী Player Control Implement করতে হবে।

## 11.3 Pause Behavior

শিক্ষার্থী Live Class চলাকালে ইচ্ছামতো Pause করতে পারবে।

Pause করলে:

- Video Playback থামবে।
- Current Video Position সংরক্ষিত থাকবে।
- Global Scheduled Timeline চলতে থাকবে।
- Class Ending Time পরিবর্তিত হবে না।
- কোনো Automatic Resume হবে না।

Pause করা অবস্থায় LIVE Button দৃশ্যমান থাকবে।

## 11.4 Play Behavior

Pause-এর পরে Play চাপলে:

- Video আগের Paused Position থেকে চলবে।
- স্বয়ংক্রিয়ভাবে Live Position-এ Jump করবে না।
- শিক্ষার্থী Live Timeline থেকে পিছিয়ে থাকলে Behind Live Indicator দেখাবে।

## 11.5 LIVE Button

Player-এ একটি সুস্পষ্ট LIVE Button থাকবে।

এটি দুইটি কাজ করবে:

1. Current Scheduled Live Position Calculate করবে।
2. Video-কে সেই Position-এ Seek করে Playback Resume করবে।

এরপর `FOLLOWING_LIVE` Mode সক্রিয় হবে।

যদি শিক্ষার্থী ইতোমধ্যে Live Position-এর কাছাকাছি থাকে, তাহলে প্রয়োজন ছাড়া বারবার Seek করবে না।

### Example

Class Start: 6:00 PM

6:30 PM:
- শিক্ষার্থী Pause করল।
- Video Position: 30:00।

6:40 PM:
- শিক্ষার্থী Play করল।
- Video Position: 30:00 থেকেই চলবে।
- Live Position: 40:00।
- Behind Live: 10 Minutes।

6:45 PM:
- শিক্ষার্থী LIVE Button চাপল।
- Video Position: 45:00 হবে।
- `FOLLOWING_LIVE` সক্রিয় হবে।

## 11.6 Playback State Model

দুটি আলাদা State Dimension Maintain করতে হবে।

**Synchronization Mode:**

- `FOLLOWING_LIVE`
- `DELAYED`

**Player State:**

- `PLAYING`
- `PAUSED`
- `BUFFERING`
- `ENDED`

এই দুটি State একসঙ্গে Manage করতে হবে।

উদাহরণ:

`DELAYED + PAUSED`

`DELAYED + PLAYING`

`FOLLOWING_LIVE + PLAYING`

শুধু UI State দেখে প্রকৃত Player Position অনুমান করা যাবে না। YouTube Player-এর Actual State নিয়মিত যাচাই করতে হবে।

---

# 12. Live Synchronization Engine

## 12.1 Fundamental Logic

Scheduled Start Time এবং Reliable Current Server Time ব্যবহার করে Expected Live Video Position Calculate করতে হবে।

Formula:

`expectedPosition = clamp((serverNow - startAt) / 1000, 0, durationSeconds)`

এখানে:

- `serverNow` = Reliable Current Time
- `startAt` = Immutable Scheduled Start Timestamp
- `durationSeconds` = Verified Video Duration

Expected Position সর্বদা Schedule-এর ওপর ভিত্তি করে Calculate হবে।

Browser-এর Playback Progress থেকে Schedule Time Calculate করা যাবে না।

## 12.2 Server Clock Synchronization

শুধু Browser-এর `new Date()`-কে Absolute Source of Truth হিসেবে ব্যবহার করা যাবে না।

একটি Reliable Time Synchronization Mechanism প্রয়োজন।

বর্তমান Netlify Functions অথবা Firebase-Compatible Lightweight Backend ব্যবহার করে Server Time পাওয়া যায় কি না পরীক্ষা করতে হবে।

Clock Offset হিসাবের ক্ষেত্রে Network Round Trip Time বিবেচনা করতে হবে।

একাধিক Time Sample নিয়ে অস্বাভাবিক Clock Offset শনাক্ত করতে হবে।

প্রয়োজনে:

- Initial Load
- Periodic Refresh
- Browser Visibility Change
- Network Recovery

এই সময়গুলোতে Clock Recalibration করতে হবে।

মিলিসেকেন্ড-নির্ভুলতা Guaranteed বলে দাবি করা যাবে না।

প্রকৃত লক্ষ্য হবে স্বাভাবিক Network Condition-এ কয়েক সেকেন্ডের মধ্যে Synchronization বজায় রাখা।

## 12.3 Following Live Mode

যখন শিক্ষার্থী Live অনুসরণ করছে:

`expectedPosition = currentServerTime - startAt`

Actual Player Position এবং Expected Position-এর Drift Calculate করতে হবে।

ছোট Drift-এর জন্য অপ্রয়োজনীয় Seek করা যাবে না।

Drift একটি Configurable Threshold অতিক্রম করলে Controlled Re-Synchronization করা যাবে।

## 12.4 Delayed Mode

শিক্ষার্থী ইচ্ছাকৃতভাবে Pause করে পিছিয়ে থাকলে:

- Playback স্বাভাবিক 1x-এ চলবে।
- Live Timeline চলতেই থাকবে।
- Behind Live Duration দেখানো হবে।
- Automatic Hard Seek করে তার Playback নষ্ট করা যাবে না।
- LIVE Button ছাড়া সে নিজে Live-এ ফিরে আসতে পারবে না।

Delayed Playback চলাকালে Buffering হলে অতিরিক্ত Delay তৈরি হতে পারে। ব্যবহারকারীকে LIVE Button-এর মাধ্যমে Catch Up করার সুযোগ দেখাতে হবে।

## 12.5 Buffering Recovery

যদি `FOLLOWING_LIVE` Mode-এ Network Buffering হয়:

- Actual Player State শনাক্ত করতে হবে।
- Buffering শেষ হলে Expected Live Position পুনরায় Calculate করতে হবে।
- Drift বেশি হলে Controlled Seek করতে হবে।
- Playback Resume করতে হবে, যদি Browser Policy অনুমতি দেয়।
- প্রয়োজন হলে Audio Unblock Interaction চাওয়া হবে।

যদি `DELAYED` Mode-এ Buffering হয়:

- User-এর Intentional Delay Preserve করতে হবে।
- সরাসরি Live-এ Jump করা যাবে না।
- Behind Live Indicator Update করতে হবে।

## 12.6 Browser Visibility

Background Tab Throttling বিবেচনায় রাখতে হবে।

Browser Tab Hidden থেকে Visible হলে:

- Clock Sync যাচাই করতে হবে।
- Schedule Status পুনরায় Calculate করতে হবে।
- `FOLLOWING_LIVE` হলে Live Position Recalculate করতে হবে।
- `DELAYED` হলে User-এর Playback Position Preserve করতে হবে।

## 12.7 Leave & Rejoin

Browser বন্ধ করা, Refresh করা বা Website থেকে বের হয়ে যাওয়া Schedule Timeline থামাবে না।

Rejoin করলে:

- Schedule Status পুনরায় Calculate হবে।
- Class Upcoming হলে Waiting Room।
- Class Live হলে Current Live Position।
- Class Ended হলে Recorded Review Mode।

Rejoin-এর সময় পুরোনো Recorded Progress থেকে Live Position নেওয়া যাবে না।

---

# 13. Post-Class Automatic Restoration

## 13.1 Class End

`now >= endAt` হলে:

- Live Status Ended হবে।
- Live Playback Route শেষ হবে।
- Live Controls আর দেখানো হবে না।
- Recorded Access Unlock হবে।
- Review Class Action প্রদর্শিত হবে।

ক্লাসের নির্ধারিত End Time কখনো শিক্ষার্থীর Pause, Leave বা Buffering-এর কারণে বাড়বে না।

যদি Video তখনো Buffering করে অথবা সম্পূর্ণ Playback না হয়ে থাকে, তবুও Schedule End Time অনুযায়ী Recorded Mode Unlock হবে।

## 13.2 Full Recorded Player Restoration

Class End হওয়ার পর Original Recorded Player-এর সব Features ফিরে আসবে:

- Existing Play/Pause
- Seek Bar
- Playback Speed
- Video Quality
- Skip Forward/Backward
- Keyboard Shortcuts
- Existing Timestamps
- Existing Slides
- Existing Notes
- Existing Bookmarks
- Existing Auto Resume
- Saved Recorded Progress

Recorded Player যেন Class-এর আগে যেমন ছিল ঠিক তেমনই ব্যবহার করা যায়।

## 13.3 Data Preservation

Live Mode কোনোভাবেই নিচের Existing Data Overwrite করবে না:

- Original `savedProgress`
- Original Lecture Metadata
- Existing Timestamp List
- Existing Slide Data
- Existing Notes
- Existing Bookmarks

Live Playback Progress এবং Recorded Progress সম্পূর্ণ আলাদা থাকবে।

Class শেষ হওয়ার পর পূর্বের Recorded Progress ঠিক আগের জায়গা থেকে Resume করা যাবে।

## 13.4 Review Experience

Schedule Page থেকে Ended Class নির্বাচন করলে `Review Class` Action পাওয়া যাবে।

এর মাধ্যমে Existing Recorded Watch Route-এ যাওয়া যাবে।

এটি নতুন Player বানানোর পরিবর্তে Existing Recorded Player ব্যবহার করবে।

---

# 14. Attendance & Study Analytics

প্রতিটি Scheduled Class-এর জন্য একটি Attendance Record তৈরি করতে হবে।

এখানে নিচের Data Track করতে হবে:

| Metric | Meaning |
|---|---|
| Scheduled Duration | মোট নির্ধারিত সময় |
| Join Time | প্রথম কখন প্রবেশ করেছে |
| Last Leave Time | সর্বশেষ কখন বের হয়েছে |
| Total Active Playback | প্রকৃত ভিডিও Play হওয়ার সময় |
| Total Pause Duration | মোট Pause Time |
| Buffering Duration | Network Buffering |
| Late Join Duration | কতক্ষণ পরে Join করেছে |
| Attendance Percentage | নির্ধারিত সময়ের তুলনায় উপস্থিতির হার |
| Live Following Time | কতক্ষণ Live অনুসরণ করেছে |
| Delayed Viewing Time | কতক্ষণ পিছিয়ে থেকে দেখেছে |

## 14.1 Attendance Calculation

Pause Duration-কে Active Study Time হিসেবে গণনা করা যাবে না।

Buffering এবং Idle Time-ও Active Playback Time নয়।

Actual Playing Time নির্ভরযোগ্য Playback State Tracking-এর ভিত্তিতে Calculate করতে হবে।

Attendance Percentage এবং Active Learning Duration আলাদা Metric হবে।

উদাহরণ:

Scheduled Duration: 90 Minutes

Actual Playing Time: 72 Minutes

Attendance Percentage এবং Completion Percentage আলাদা করে প্রকাশ করতে হবে।

কেবল Play Button চাপা বা Browser Tab খোলা থাকার ভিত্তিতে Attendance গণনা করা যাবে না।

## 14.2 Session Integration

বর্তমান `sessions.service.ts` এবং Study Goal/Strike Architecture পরীক্ষা করে প্রয়োজন অনুযায়ী Integration করতে হবে।

Live Class থেকে Daily Study Goal এবং Study Streak Update করা যাবে।

একই সময় একাধিক Active Session তৈরি হওয়া প্রতিরোধ করতে হবে।

Attendance Events Idempotent করতে হবে, যাতে Refresh বা Rejoin-এ Duplicate Data তৈরি না হয়।

---

# 15. Schedule Notifications & Reminders

একটি Lightweight Reminder System থাকা উচিত।

প্রস্তাবিত Reminder:

- Class-এর 15 Minutes আগে
- Class-এর 5 Minutes আগে
- Class Start হওয়ার সময়
- Class End হওয়ার সময়

প্রথম Version-এ In-App Reminder অগ্রাধিকার পাবে।

Browser Notification শুধুমাত্র Permission থাকলে ব্যবহার করা যাবে।

Browser বন্ধ থাকলে Reminder দেখানোর জন্য আলাদা Push Infrastructure প্রয়োজন কি না Architecture Assessment-এ যাচাই করতে হবে।

Reminder-এর কারণে কোনো Paid Service বাধ্যতামূলক করা যাবে না।

---

# 16. Recommended User Experience

## 16.1 Design Principles

ZyntraFocus-এর বর্তমান Design Language বজায় রাখতে হবে।

মূল Design Requirements:

- Premium Dark UI
- Minimal Interface
- Distraction-Free Layout
- Clear Typography
- Consistent Spacing
- Subtle Status Indicators
- Responsive Layout
- Minimal Animation
- Fast Interaction
- No Unnecessary Decoration

## 16.2 Animation Policy

Framer Motion বা অন্য কোনো Heavy Animation Dependency যুক্ত করা যাবে না।

বর্তমান Tailwind CSS এবং CSS Transition দিয়েই প্রয়োজনীয় UI Feedback তৈরি করতে হবে।

অপ্রয়োজনীয় Motion, Particle Effect, Heavy Gradient Animation কিংবা Background Animation থাকবে না।

## 16.3 Responsive Design

Desktop:

- বড় Thumbnail Cards
- Spacious Player Layout
- সহজ Timetable Navigation

Mobile:

- Stacked Class Cards
- সহজে ব্যবহারযোগ্য LIVE Button
- Touch-Friendly Controls
- Responsive Player
- Scroll-Friendly Schedule

Mobile Experience কোনোভাবেই Desktop Layout-এর ছোট সংস্করণমাত্র হওয়া উচিত নয়। Mobile অনুযায়ী Layout Adapt করতে হবে।

---

# 17. Information Architecture & Routing

প্রস্তাবিত Routes:

| Route | Purpose |
|---|---|
| `/schedule` | Complete Schedule |
| `/schedule/create` | Draft Schedule Builder |
| `/live/:scheduleId` | Scheduled Live Player |
| `/schedule/history` | Completed Class History |
| Existing Watch Route | Normal Recorded Player |

প্রয়োজন অনুযায়ী বর্তমান `routes.ts` এবং `App.tsx`-এর Architecture অনুযায়ী Routes Integrate করতে হবে।

### Navigation

প্রধান Navigation-এ Schedule Access সহজে পাওয়া যাবে।

Dashboard থেকেই Upcoming Class এবং Complete Timetable-এ যাওয়া যাবে।

Live Class চলাকালে অপ্রয়োজনীয় Navigation Distraction কমিয়ে দিতে হবে।

---

# 18. Recommended Data Architecture

বর্তমান Firestore Personal Workspace Model বজায় রাখতে হবে।

প্রস্তাবিত Scheduled Classes Collection:

`users/{userId}/scheduledClasses/{scheduleId}`

একটি Schedule Document-এ সম্ভাব্য Fields:

| Field | Purpose |
|---|---|
| `scheduleId` | Unique Schedule ID |
| `lectureId` | Existing Lecture Reference |
| `title` | Snapshot Lecture Title |
| `subjectId` | Subject Reference |
| `chapterId` | Chapter Reference |
| `youtubeVideoId` | Scheduled Video Reference |
| `thumbnailUrl` | Video Thumbnail |
| `durationSeconds` | Verified Duration |
| `startAt` | Immutable UTC Timestamp |
| `endAt` | Immutable UTC Timestamp |
| `timezone` | Asia/Dhaka |
| `lockedAt` | Lock Creation Time |
| `lockVersion` | Schema/Lock Version |
| `createdAt` | Document Creation Time |

প্রকৃত Implementation-এ Existing Types এবং Conventions অনুযায়ী Schema নির্ধারণ করতে হবে।

### Live Playback State

প্রস্তাবিত আলাদা State:

- `syncMode`
- `playerState`
- `lastObservedPosition`
- `lastJoinedAt`
- `lastSeenAt`

এগুলোকে Immutable Schedule Fields-এর সঙ্গে মিশিয়ে ফেলা যাবে না।

Live Playback State Device Session-ভিত্তিক হতে পারে। Multiple Device Support প্রয়োজন হলে উপযুক্ত Session Model প্রস্তাব করতে হবে।

### Attendance Data

সম্ভাব্য Subcollection:

`users/{userId}/scheduledClasses/{scheduleId}/attendance/{sessionId}`

এখানে পৃথক Join/Leave/Playback Event বা Aggregated Session Data রাখা যেতে পারে।

Duplicate Event প্রতিরোধের জন্য Idempotency Strategy প্রয়োজন।

### Recorded Access Protection

Scheduled Lecture-এর সঙ্গে একটি Temporary Access Lock যুক্ত থাকতে হবে।

সম্ভাব্য Data:

- `scheduleId`
- `lockedAt`
- `unlockAt`
- `accessMode`

এই Lock-এর কার্যকারিতা:

`Current Time < unlockAt` → Recorded Mode Blocked

`Current Time >= unlockAt` → Recorded Mode Allowed

Lecture Data-এর সঙ্গে Lock কীভাবে Integrate হবে, তা বর্তমান Firestore Rules ও Existing Services পরীক্ষা করে চূড়ান্ত করতে হবে।

একটি Lecture-এর Existing Data নষ্ট না করে Access State আলাদাভাবে Manage করতে হবে।

---

# 19. Security & Access Control

Security অবশ্যই Frontend-এর বাইরেও Enforce করতে হবে।

### Requirements

1. User শুধুমাত্র নিজের Workspace-এর Schedule Access করতে পারবে।
2. Locked Schedule সাধারণ Client Request দিয়ে পরিবর্তন করা যাবে না।
3. Locked Schedule Delete করা যাবে না।
4. Recorded Watch Access Lock যাচাই করবে।
5. Locked Lecture-এর Recorded Resources যথাযথভাবে Protect করতে হবে।
6. Live Route-এর Direct Access Schedule Status যাচাই করবে।
7. Schedule End Time-এর আগে Recorded Access দেওয়া যাবে না।
8. Authentication Validation বজায় রাখতে হবে।
9. Untrusted Client-এর Time বা Attendance Data সরাসরি বিশ্বাস করা যাবে না।

Firestore Security Rules-এ Locked Document-এর Update/Delete নিষিদ্ধ করার উপযুক্ত Strategy নিতে হবে।

`request.time` এবং প্রয়োজন অনুযায়ী Existing Rules-এর Document-Level Validation পরীক্ষা করতে হবে।

### Important Security Boundary

YouTube IFrame Player এবং Public/Unlisted Video ID ব্যবহার করলে ব্রাউজারে ভিডিওর পরিচয় সম্পূর্ণ গোপন বা DRM-স্তরে Protected রাখা সম্ভব নয়।

ZyntraFocus-এর ভেতরে Recorded Mode Access Block করা যাবে, কিন্তু কেউ ভিডিওর সরাসরি YouTube Link/ID পেয়ে গেলে অন্য জায়গায় সেটি দেখার সম্ভাবনা পুরোপুরি বন্ধ করা যাবে না।

এছাড়া Developer Tools ব্যবহার করে Client-Side Controls Manipulate করাও সম্পূর্ণ প্রতিরোধ করা সম্ভব নয়।

এই সীমাবদ্ধতা Product Documentation-এ স্পষ্ট রাখতে হবে।

---

# 20. Technical Requirements & Constraints

## 20.1 Time Authority

একটি Reliable Server Time Reference প্রয়োজন।

কেবল Device Clock-এর ওপর নির্ভর করা যাবে না।

## 20.2 Database Consistency

Schedule Lock এবং Recorded Access Lock-এর মধ্যে Consistency বজায় রাখতে হবে।

Lock সফলভাবে তৈরি না হলে Schedule-কে Finalized দেখানো যাবে না।

Schedule এবং Lecture Access Lock-এর প্রয়োজনীয় Write Atomic বা নিরাপদ Transactional Workflow-তে সম্পন্ন করতে হবে।

## 20.3 Performance

- Schedule Page দ্রুত Load হতে হবে।
- Dashboard-এ অপ্রয়োজনীয় Full Collection Fetch করা যাবে না।
- Upcoming Query Efficient হতে হবে।
- Thumbnail Lazy Load করা যাবে।
- Live Sync Logic অপ্রয়োজনীয় Player Reinitialization করবে না।
- প্রতি সেকেন্ডে Firestore Network Request করা যাবে না।
- Timer ও Player Listener Cleanup করতে হবে।

## 20.4 Existing Player Isolation

Recorded Mode এবং Live Mode-এর Behavior আলাদা রাখতে হবে।

Live Mode-এর জন্য অসংখ্য Conditional Logic যোগ করে Existing `WatchPage.tsx` জটিল করা উচিত নয়।

প্রয়োজনে Shared Player Utilities ও Dedicated Live Player Component ব্যবহার করতে হবে।

---

# 21. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Lightweight and Responsive |
| Reliability | Refresh/Rejoin Safe |
| Data Safety | No Existing Data Loss |
| Security | Server/Database-Enforced Access |
| Time Accuracy | Reliable Clock Synchronization |
| Maintainability | Modular Services |
| Compatibility | Existing React/Firebase Stack |
| UI | Distraction-Free |
| Mobile | Fully Responsive |
| Accessibility | Keyboard and Screen-Reader Friendly Where Applicable |

---

# 22. Failure & Edge Case Handling

এই পরিস্থিতিগুলো Handle করতে হবে:

### A. YouTube Video Unavailable

Schedule Lock-এর আগে Video Availability যাচাই করতে হবে।

Lock-এর পরে Video Unavailable হলে নির্ধারিত Schedule Cancel বা Extend করা যাবে না।

স্পষ্ট Error State দেখাতে হবে এবং Class History-তে সমস্যা সংরক্ষণ করতে হবে।

### B. Internet Disconnection

Following Live Mode-এ Connection ফিরে এলে Current Live Position পুনরায় Calculate করে Recovery করতে হবে।

Delayed Mode-এ Intentional Playback Offset Preserve করতে হবে এবং Behind Live Indicator Update করতে হবে।

### C. Browser Closed

Schedule Timeline চলতে থাকবে।

ক্লাস শেষ হলে Recorded Mode সময় অনুযায়ী স্বয়ংক্রিয়ভাবে Unlock হবে।

### D. Device Clock Changed

Device-এর ভুল Clock Schedule Timing পরিবর্তন করতে পারবে না।

### E. Multiple Devices

একই Account দুইটি Device থেকে একই Live Class Join করলে প্রত্যেক Device-এর Live Position একই Server Timeline থেকে Calculate হবে।

এক Device-এর Pause অন্য Device-এর Playback বাধ্যতামূলকভাবে Pause করবে কি না, এটি আলাদা Session Policy হিসেবে নির্ধারণ করতে হবে। প্রথম Version-এ Device Playback State আলাদা রাখা শ্রেয়।

### F. Schedule Conflict

Overlapping Schedule Lock করা যাবে না।

### G. Late Join

Class Start হওয়ার পরে কিন্তু End হওয়ার আগে Join করলে Current Live Position থেকে শুরু হবে।

### H. Class Not Attended

শিক্ষার্থী Join না করলেও End Time-এর পর Recorded Access Restore হবে।

### I. End Time Reached During Pause

Pause অবস্থায় End Time অতিক্রম করলে Recorded Mode Unlock হবে।

### J. Video Duration Mismatch

YouTube Video Duration পরিবর্তিত বা Unavailable হলে Schedule তৈরি এবং Running Class-এর জন্য নিরাপদ Fallback প্রয়োজন।

Original Locked Schedule-এর Ending Time নীরবে পরিবর্তন করা যাবে না।

---

# 23. Acceptance Criteria

Implementation Complete বলা যাবে না যতক্ষণ না নিচের সব Core Criteria পূরণ হয়।

## Schedule Management

- [ ] Existing Lecture থেকে Schedule তৈরি করা যায়।
- [ ] Draft Edit করা যায়।
- [ ] Final Preview পাওয়া যায়।
- [ ] Lock Routine কার্যকর হয়।
- [ ] Locked Schedule Edit করা যায় না।
- [ ] Locked Schedule Delete করা যায় না।
- [ ] Duplicate Active Lecture Schedule Block হয়।
- [ ] Overlapping Schedule Block হয়।

## Recorded Lock

- [ ] Locked Lecture Recorded Library থেকে Hide হয়।
- [ ] Search থেকে Hide হয়।
- [ ] Subject/Chapter List থেকে Hide হয়।
- [ ] Direct Recorded URL Block হয়।
- [ ] Recorded Slides/Resources-এর Access যথাযথভাবে Block হয়।
- [ ] অন্য Recorded Lectures স্বাভাবিকভাবে কাজ করে।

## Upcoming Dashboard

- [ ] পরবর্তী ৩টি ক্লাস Thumbnail Card-এ দেখা যায়।
- [ ] Correct Date ও Time দেখা যায়।
- [ ] Countdown সঠিক থাকে।
- [ ] Live Class Top Priority পায়।
- [ ] Schedule List Chronological Order-এ থাকে।

## Live Player

- [ ] নির্ধারিত Start Time-এ Live State হয়।
- [ ] Late Join সঠিক Position থেকে শুরু হয়।
- [ ] Playback Speed 1x থাকে।
- [ ] Seek Disabled থাকে।
- [ ] Pause কাজ করে।
- [ ] Pause করলেও Schedule Timeline চলে।
- [ ] Play আগের Position থেকে শুরু হয়।
- [ ] LIVE Button Current Position-এ Sync করে।
- [ ] Delayed Indicator সঠিক থাকে।
- [ ] Network Recovery সঠিকভাবে কাজ করে।

## Post-Class Restoration

- [ ] End Time-এ Live Mode শেষ হয়।
- [ ] Recorded Access Automatically Unlock হয়।
- [ ] Existing Timestamps ফিরে আসে।
- [ ] Existing Slides ফিরে আসে।
- [ ] Notes এবং Bookmarks অক্ষত থাকে।
- [ ] Existing Recorded Progress অক্ষত থাকে।
- [ ] Original WatchPage স্বাভাবিকভাবে কাজ করে।

## Data & Security

- [ ] Existing User Data Loss হয় না।
- [ ] Firestore Rules Lock Enforce করে।
- [ ] User অন্য User-এর Schedule Access করতে পারে না।
- [ ] Refresh করলে Schedule State সঠিক থাকে।
- [ ] Browser বন্ধ থাকলেও Unlock সঠিক থাকে।
- [ ] Duplicate Attendance তৈরি হয় না।

## Design & Performance

- [ ] Desktop Responsive।
- [ ] Mobile Responsive।
- [ ] No Heavy Animation Dependency।
- [ ] Existing Design System বজায় থাকে।
- [ ] Unnecessary Database Requests নেই।
- [ ] Timer এবং Event Listener Cleanup হয়।

---

# 24. Implementation Roadmap

Implementation একসঙ্গে বিশাল Code Change হিসেবে করা যাবে না।

ধাপে ধাপে কাজ সম্পন্ন করতে হবে।

## Phase 1 — Foundation & Data Model

- Schedule Types
- Schedule Service
- Firestore Schema
- Schedule Validation
- Draft Handling
- Immutable Lock Workflow
- Recorded Access Lock Foundation
- Security Rules

Phase 1 Complete না হলে Live Player শুরু করা যাবে না।

## Phase 2 — Dashboard & Schedule UI

- Upcoming Classes Section
- Next Three Class Cards
- Today's Classes
- Complete Schedule Page
- Schedule Builder
- Draft Preview
- Lock Routine Confirmation
- Completed History

## Phase 3 — Time Synchronization Engine

- Reliable Server Clock
- Clock Offset
- Expected Live Position Calculator
- Schedule Status Engine
- Buffering Detection
- Drift Calculation
- Visibility Recovery

এই Phase-এ Player Integration করার আগে Synchronization Logic আলাদা করে Test করতে হবে।

## Phase 4 — Live Player

- Dedicated Live Player Route
- Existing YouTube Player Reuse
- Restricted Controls
- Pause/Play
- FOLLOWING_LIVE
- DELAYED
- LIVE Button
- Late Join
- Refresh/Rejoin
- Buffering Recovery
- Scheduled End Handling

## Phase 5 — Recorded Restoration

- Recorded Access Unlock
- Existing Watch Route Restoration
- Existing Timestamp Restoration
- Existing Slide Restoration
- Existing Notes/Bookmark Access
- Existing Progress Preservation

## Phase 6 — Attendance & Analytics

- Join/Leave Tracking
- Active Playback Tracking
- Pause Duration
- Buffering Duration
- Live Following Time
- Attendance Summary
- Existing Study Session Integration

## Phase 7 — Final Testing & Optimization

- Desktop Testing
- Mobile Testing
- Network Failure Testing
- Time Synchronization Testing
- Security Testing
- Firestore Rules Testing
- Existing Recorded Player Regression Testing
- Performance Testing

প্রতিটি Phase শেষে Working State যাচাই করতে হবে।

এক Phase-এর Regression Fix না করে পরবর্তী Phase-এ যাওয়া যাবে না।

---

# 25. Final Product Quality Standard

আমি শুধু একটি কার্যকর Feature চাই না।

আমি চাই ZyntraFocus-এর Scheduled Live Learning System ব্যবহার করতে গিয়ে শিক্ষার্থীর মনে হবে এটি একটি সুপরিকল্পিত Premium LMS।

নিচের বিষয়গুলোতে কোনো অবহেলা গ্রহণযোগ্য নয়:

1. Schedule Lock অবশ্যই নির্ভরযোগ্য হতে হবে।
2. Recorded Lock যেন সহজে Bypass করা না যায়।
3. Live Synchronization যেন বাস্তবসম্মত ও নির্ভরযোগ্য হয়।
4. Pause এবং LIVE আচরণ যেন পরিষ্কার ও Predictable হয়।
5. Class End হলে Existing Recorded Experience সম্পূর্ণ ফিরে আসে।
6. Existing Learning Resources কখনো নষ্ট হবে না।
7. Dashboard অত্যন্ত পরিচ্ছন্ন হবে।
8. Mobile Experience ভালো হবে।
9. Application Lightweight থাকবে।
10. অপ্রয়োজনীয় নতুন Technology যোগ করা হবে না।

### Product Success Metrics

Feature সফল হয়েছে বলে বিবেচনা করতে হলে:

- Schedule Lock-এর পর Scheduled Lecture Recorded Mode-এ অনুপলব্ধ থাকবে।
- Live Start এবং End Time নির্ভুলভাবে Enforce হবে।
- Pause/Play/LIVE State সঠিকভাবে কাজ করবে।
- Rejoin করলে সঠিক অবস্থায় প্রবেশ করবে।
- Class End-এর পর Recorded Mode স্বয়ংক্রিয়ভাবে ফিরে আসবে।
- কোনো Existing Timestamp, Slide, Note বা Progress হারাবে না।
- সব Core Flow Desktop এবং Mobile-এ কাজ করবে।

---

# 26. Final Instruction to Antigravity

এই PRD-কে Scheduled Live Learning System-এর Authoritative Product Specification হিসেবে বিবেচনা করবে।

Implementation-এর সময় কোনো Requirement নিজের ইচ্ছামতো বাদ দেওয়া, সহজ করে ফেলা বা পরিবর্তন করা যাবে না।

যেখানে Technical Limitation রয়েছে সেখানে বাস্তব সীমাবদ্ধতা ব্যাখ্যা করবে।

বিশেষ করে YouTube IFrame Player-এর সীমাবদ্ধতা, Client-Side Manipulation, Firebase Security Rules এবং Server-Time Accuracy সম্পর্কে মিথ্যা নিশ্চয়তা দেওয়া যাবে না।

প্রথমে সম্পূর্ণ PRD অনুযায়ী বর্তমান Architecture-এর সঙ্গে Requirement Mapping করবে।

তারপর:

1. Existing Files/Components Mapping।
2. Required New Files।
3. Required Modified Files।
4. Firestore Schema।
5. Security Rules Plan।
6. Service Architecture।
7. Component Architecture।
8. Data Migration/Safety Plan।
9. Testing Strategy।
10. Phase-by-Phase Implementation Plan।

সবকিছু উপস্থাপন করবে।

প্রথম ধাপে কোনো Code Change করবে না।

Implementation শুরু করার জন্য আমার পৃথক নির্দেশনার অপেক্ষা করবে।

**Final Objective: Build a Premium, Lightweight, Distraction-Free Scheduled Live Learning Management System inside ZyntraFocus without breaking its existing Recorded Learning Experience.**