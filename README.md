# 2026 Goals Website

A minimal personal website for daily check-ins against three 2026 goals:
1) **Value What I Have** (less material focus)  
2) **Lead with Humility** (less ego-led)  
3) **Build My Running Career**

## Features
- Daily check-in (defaults to **yesterday**) with:
  - 3 questions (one per goal)
  - 1–5 rating per goal
  - free-text notes per goal (daily diary)
- Dashboard showing:
  - yesterday’s saved ratings and notes
  - monthly % achieved per goal (avg rating / 5)
  - daily mantras per goal (deterministic daily rotation)
- History view:
  - recent entries grouped by month
  - month-level goal % summaries
  - quick edit via date links

## Tech
- **Next.js (App Router) + TypeScript**
- **Firebase Authentication** (anonymous sign-in) + **Cloud Firestore**
- Deploys cleanly to **Vercel**

---

## 1) Create Firebase project
1. Create a Firebase project.
2. Enable **Firestore Database**.
3. Enable **Authentication** → **Sign-in method** → enable **Anonymous**.
4. Project settings → add a **Web app**, copy the Firebase config values.

### Recommended Firestore rules (private-by-default)
Paste these into Firestore Rules (Firestore → Rules):

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This makes data readable/writable only for the signed-in anonymous user.

---

## 2) Run locally
```bash
npm install
cp .env.example .env.local
# fill in Firebase values in .env.local
npm run dev
```
Open http://localhost:3000

---

## 3) Deploy to Vercel
1. Push this repo to GitHub.
2. In Vercel, **Import Project** from GitHub.
3. Add Environment Variables in Vercel (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
4. Deploy.

---

## Data model
Firestore path:
- `users/{uid}/entries/{YYYY-MM-DD}`

Document fields:
- `date`: `YYYY-MM-DD`
- `ratings`: `{ material: 1-5, ego: 1-5, running: 1-5 }`
- `comments`: `{ material: string, ego: string, running: string }`
- `createdAt`, `updatedAt`: server timestamps

---

## Notes
- The check-in defaults to ranking **yesterday** (matching your “rank my previous day” intent).
- Mantras rotate per-goal per-day, so you get a stable daily phrase that changes over time.

