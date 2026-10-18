# Exercise Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-installable PWA that hands the user calisthenics exercise
cards to perform in three deck modes (ordered / shuffled / free-select),
logs each performed set (count + unit + which of 4 variants), and resumes
across launches.

**Architecture:** A pure, DOM-free `engine/deck.ts` holds all session logic
(ordered/shuffled/free-select, perform/skip/defer/end, summary) over a small
`Session`/`LogEntry`/`Exercise` model. A `storage/db.ts` DAO over Dexie
(IndexedDB) persists the exercise set, performed-logs, and the active session.
React components (`CardView`, `PerformPanel`, `ModePicker`, `CardPicker`,
`SessionSummary`, `AddExerciseForm`) are thin shells that call the engine and
DAO. Workbox caches the shell for full offline; Dexie is the source of truth.

**Tech Stack:** Vite 5, React 18 (TypeScript strict), Vitest 1 with jsdom and
`@testing-library/react`, Dexie 4, `fake-indexeddb` for Node-side DAO tests,
Workbox 7 (via `vite-plugin-pwa`). Node ≥18.12.

**Spec:** `calisthenics/DESIGN.md` — the plan argues from that doc; executors
read both.

## Global Constraints

Applied to **every** task, verbatim from `DESIGN.md`:

- Node 18.15 is the box; stack must run on it. Pin Vite to **5.x** (Vite 6/7
  require Node 20+).
- No network at runtime. No fetch, no CDN, no external fonts/scripts.
- All state lives in IndexedDB via Dexie. No `localStorage`, no `async`
  storage outside Dexie.
- TypeScript strict; no `any` in `src/engine/**` or `src/storage/**`.
- Every task ends with the suite green via `npx vitest run` before commit.
- `git init` at the project root uses the user's **existing** git identity —
  do **not** set a dummy `user.email` / `user.name`.
- Data model is fixed: `Exercise`, `Variant`, `LogEntry` (with `count` +
  `unit`), `Session` — three Dexie tables. See `DESIGN.md` §Data model.
- One active session at a time. Starting a new session ends the previous one.
  Ending never deletes that session's `LogEntry` rows.
- The `calisthenics/` project already exists at `/Users/engineer/repo/
  calisthenics/`; `DESIGN.md` is already there. `git` has not yet been
  initialized at that path.

## Review Focus

Five input classes / failure modes a user meets but that easy tests miss —
each line carries a test added to the task noted after it:

- **Reload mid-session** — a session with a non-empty `queue` and non-empty
  `performed` must resume at that exact state on next launch, not start new.
  Test in **Task 4** (`db.ts` round-trip: build a half-done session, persist,
  reload, assert engine state is identical).
- **Hold exercises (seconds)** — Plank must log as `count + unit:'seconds'`,
  not `count + unit:'reps'` by default; the summary must total per unit.
  Test in **Task 2** on `summary` and **Task 5** on `PerformPanel` (unit
  toggle defaults to `seconds` when the exercise's variants all use seconds).
- **Defer in a 1-card queue** — deferring the only card must not infinite-
  loop; it must leave the queue empty and `isDone` true. Test in **Task 3**.
- **Shuffle preserves multiset** — shuffling a deck of N cards is a
  permutation: same ids, no dups, no missing items, even when N is 1 or 0.
  Test in **Task 2**.
- **Free-select has no `isDone` trigger and no Defer button** — the summary
  screen is reached only via "End session"; Defer doesn't appear. Test in
  **Task 3** (`isDone` on a free-select deck) and **Task 5** (CardView in
  free-select mode hides Defer).

## File Structure

```
calisthenics/
├── DESIGN.md                     # approved spec (pre-existing; do not edit)
├── PLAN.md                       # this file
├── package.json
├── tsconfig.json
├── vite.config.ts                # + vite-plugin-pwa (Workbox)
├── vitest.config.ts
├── index.html                    # shell, manifest link
├── public/
│   ├── manifest.webmanifest
│   ├── icon-192.png
│   ├── icon-512.png
│   └── sw.js                     # Workbox output
└── src/
    ├── main.tsx                  # React entry; renders App
    ├── App.tsx                   # route: launch | card | summary | picker
    ├── engine/
    │   ├── types.ts              # Exercise, Variant, LogEntry, Session, Deck, Unit
    │   ├── deck.ts               # buildQueue, startSession, nextCard,
    │   │                         # perform, skip, defer, isDone, endSession,
    │   │                         # summary
    │   └── deck.test.ts
    ├── storage/
    │   ├── db.ts                 # Dexie instance + DAO
    │   ├── seeds.ts              # first-open seed exercise set
    │   └── db.test.ts
    ├── components/
    │   ├── PerformPanel.tsx      # + .test.tsx
    │   ├── CardView.tsx          # + .test.tsx
    │   ├── ModePicker.tsx        # + .test.tsx
    │   ├── CardPicker.tsx        # + .test.tsx
    │   ├── SessionSummary.tsx    # + .test.tsx
    │   └── AddExerciseForm.tsx   # + .test.tsx
    └── service/
        └── session.ts            # glue: reads active session from DAO,
                                  # builds Deck, dispatches to engine,
                                  # persists back; consumed by App.tsx
```

The `service/session.ts` module is the only place UI code and engine/DAO
touch; components never import Dexie or the engine directly. This boundary is
what keeps the RTL tests fast (mock the service, not the DB).

---

## Task 1: Project scaffold, toolchain, offline shell

**Files:**
- Create: `calisthenics/package.json`, `.gitignore`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `src/main.tsx`, `src/App.tsx`, `src/smoke.test.ts`
- Test: `src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a running Vite 5 + React 18 + TypeScript project with Vitest
  passing on Node 18, Dexie installed, and a Workbox service worker
  registered. Later tasks import React/TSX and run `npx vitest run`.

- [ ] **Step 1: Git-init with the user's existing identity**

Run `git init` at `calisthenics/`. Write a `.gitignore` covering
`node_modules/` and `dist/`. Do **NOT** set `user.email` or `user.name` —
rely on the existing config. If `git config user.email` or `user.name` is
empty, **stop and ask** the user; never write a dummy.

- [ ] **Step 2: Install the fixed stack**

Run `npm init -y`, then install — runtime: `react@18 react-dom@18 dexie`;
dev: `typescript @types/react @types/react-dom @types/node vite@^5
@vitejs/plugin-react vitest@^1 jsdom @testing-library/react
@testing-library/jest-dom @testing-library/user-event fake-indexeddb
vite-plugin-pwa`. `package.json` scripts: `"dev": "vite"`,
`"build": "vite build"`, `"preview": "vite preview"`, `"test": "vitest run"`,
`"test:watch": "vitest"`.

- [ ] **Step 3: Write the config**

`tsconfig.json` with `"strict": true`, `moduleResolution: "bundler"`,
`jsx: "react-jsx"`, `target: "ES2020"`. `vite.config.ts` imports
`@vitejs/plugin-react` and `vite-plugin-pwa` with `workbox` precache of the
app shell (`index.html` + assets; `dev: false`). `vitest.config.ts`:
`environment: 'jsdom'`, include `src/**/*.test.{ts,tsx}`, `globals: true`,
and a `setupFiles` that imports `@testing-library/jest-dom` and initializes
`fake-indexeddb` (see Task 4). `index.html` loads `/src/main.tsx` and links
`public/manifest.webmanifest` + PWA icons. `public/manifest.webmanifest`:
`name`, `short_name`, `start_url: "/"`, `display: "standalone"`,
`background_color`, two icon entries (192, 512).

- [ ] **Step 4: Write the smoke test**

```ts
// src/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs on this box', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run to verify the toolchain is up**

Run `npx vitest run` — Expected: PASS, 1 test. Then `npx vite build` —
Expected: builds to `dist/` with a generated `sw.js`. This proves the Node 18
stack before real code lands.

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json \
  vite.config.ts vitest.config.ts index.html public/ src/
git commit -m "chore: scaffold Vite+React PWA toolchain (offline, Vitest on Node 18)"
```

---

## Task 2: Deck engine — types, build, start, nextCard

**Files:**
- Create: `src/engine/types.ts`, `src/engine/deck.ts`, `src/engine/deck.test.ts`
- Delete: `src/smoke.test.ts` (superseded by real engine tests)

**Interfaces:**
- Consumes: nothing (pure module, no deps).
- Produces (later tasks import these exact names):
  - `type Mode = 'ordered' | 'shuffled' | 'free-select'`
  - `type Unit = 'reps' | 'seconds'`
  - `interface Variant { level: 1 | 2 | 3 | 4; label: string; howTo: string }`
  - `interface Exercise { id: string; name: string; equipment?: string; variants: Variant[]; createdAt: number }`
  - `interface LogEntry { id: string; exerciseId: string; variantLevel: 1 | 2 | 3 | 4; count: number; unit: Unit; performedAt: number; sessionId: string }`
  - `interface Session { id: string; mode: Mode; queue: string[]; status: 'active' | 'ended'; startedAt: number; endedAt?: number }`
  - `interface Deck { session: Session; performed: LogEntry[] }`
  - `buildQueue(exerciseIds: string[], mode: Mode): string[]`
  - `startSession(exerciseIds: string[], mode: Mode, now: number): Deck`
  - `nextCard(deck: Deck): string | null`

- [ ] **Step 1: Write the failing tests** (`src/engine/deck.test.ts`)

Assert:
- `buildQueue(['a','b','c'], 'ordered')` → `['a','b','c']` (a distinct copy, not the input array).
- `buildQueue(['a','b','c'], 'shuffled')` → a permutation of the same multiset (same ids, no dups, no omissions); check several inputs, **including `['a']` (N=1) and `[]` (N=0)** per Review Focus ("shuffle preserves multiset").
- `buildQueue([...], 'free-select')` → `[]`.
- `startSession(['a','b'], 'shuffled', 1000)` → `session.status === 'active'`, `session.mode === 'shuffled'`, `session.queue` a permutation of `['a','b']`, `session.startedAt === 1000`, `session.endedAt === undefined`, `performed === []`, `session.id` a non-empty generated string.
- `nextCard` on an ordered deck returns the first queued id; on a `free-select` deck returns `null`; with an empty queue returns `null`.

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/engine/deck.test.ts` — Expected: FAIL
("cannot find module" / functions undefined).

- [ ] **Step 3: Implement `types.ts`, then the three functions in `deck.ts`**

Generate ids with `crypto.randomUUID()`. `shuffled` via Fisher–Yates on a
copied array, so it doesn't mutate its input. `buildQueue('free-select')`
returns `[]`. Bodies are small; only the Fisher–Yates shuffle deserves a
second look.

- [ ] **Step 4: Run to confirm they pass**

Run: `npx vitest run src/engine/deck.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): types, buildQueue, startSession, nextCard"
```

---

## Task 3: Deck engine — perform, skip, defer, isDone, endSession, summary

**Files:**
- Modify: `src/engine/deck.ts`, `src/engine/deck.test.ts`
- Test: `src/engine/deck.test.ts`

**Interfaces:**
- Consumes (from Task 2): `Deck`, `Session`, `LogEntry`, `Unit`,
  `startSession`, `nextCard`, the `Mode` type.
- Produces:
  - `perform(deck: Deck, exerciseId: string, variantLevel: 1|2|3|4, count: number, unit: Unit, now: number): Deck`
    — appends a new `LogEntry` to `performed` and removes `exerciseId` from the queue. No-op (returns `deck` unchanged) if `exerciseId` isn't in the queue.
  - `skip(deck: Deck, exerciseId: string): Deck` — removes `exerciseId` from the queue; leaves `performed` unchanged.
  - `defer(deck: Deck, exerciseId: string): Deck` — moves `exerciseId` from its current position to the **end** of the queue. If it was already at the end, the queue is unchanged. No-op if `exerciseId` isn't in the queue.
  - `isDone(deck: Deck): boolean` — `true` iff `queue` is empty **AND** `mode` is `'ordered'` or `'shuffled'`. In `'free-select'` mode, always `false` (user ends it explicitly via `endSession`).
  - `endSession(deck: Deck, now: number): Deck` — sets `session.status = 'ended'`, `session.endedAt = now`; leaves `queue` and `performed` untouched.
  - `summary(deck: Deck): { sets: number; totalReps: number; totalSeconds: number; items: LogEntry[] }`
    — `sets === performed.length`; `totalReps` sums `count` of all `performed` with `unit === 'reps'`; `totalSeconds` sums `count` with `unit === 'seconds'`; `items` is a defensive copy of `performed`.

- [ ] **Step 1: Write the failing tests** (`src/engine/deck.test.ts`)

Assert:
- `perform(deck, 'a', 1, 10, 'reps', 1000)` → exactly one new `LogEntry` with `{ exerciseId:'a', variantLevel:1, count:10, unit:'reps', performedAt:1000, id:<non-empty> }`; `session.queue` no longer contains `'a'`; `performed` length increased by exactly 1; the new entry is appended last.
- `perform` on a `free-select` deck (queue empty, user picked `'a'`) appends the log but doesn't touch an empty queue (the picker isn't a queue).
- `perform` with an `exerciseId` not in the queue returns the deck with `performed.length` unchanged and no new `LogEntry` appended.
- `skip(deck, 'a')` → `queue` no longer contains `'a'`; `performed` is untouched.
- `defer(deck, 'b')` where `queue=['a','b','c']` → `queue=['a','c','b']`; `set(queue)` still has same three ids.
- **Defer on a 1-card ordered queue is done** (Review Focus): `startSession(['a'], 'ordered', 0)` then `defer(deck, 'a')` → `queue=['a']` unchanged (already at the back); `isDone(deck)` is `true` iff `queue=[]` — but deferring doesn't empty it, so `isDone` is `false` unless `session.queue` was `[]`; assert this: `startSession([], 'ordered', 0)` then `isDone` is `true`.
- `isDone`:
  - ordered/shuffled modes with empty queue → `true`; non-empty queue → `false`.
  - free-select mode with empty queue → `false`; with non-empty queue → `false` (free-select never auto-ends; the user calls `endSession`).
- `endSession` sets `status='ended'`, `endedAt` equals the arg, leaves `queue` and `performed` unchanged.
- `summary`: build a `Deck` with mixed `performed` — two `'reps'` (10, 15) and one `'seconds'` (60). Assert `{ sets: 3, totalReps: 25, totalSeconds: 60, items: <same 3 entries in a distinct array> }`.
- `summary([])` on a deck with no `performed` → `{ sets:0, totalReps:0, totalSeconds:0, items:[] }`.

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/engine/deck.test.ts` — Expected: FAIL
("perform is not a function", etc.).

- [ ] **Step 3: Implement the six functions in `src/engine/deck.ts`**

`perform` guards on `exerciseId` presence, appends the `LogEntry` (id via
`crypto.randomUUID()`, `performedAt===now` arg), and strips the card from the
queue. `skip`/`defer` are queue-mutation helpers with the same guard;
`defer` is `[...rest, ex]` when `ex` isn't already last. `isDone` branches on
`mode`. `endSession` returns a shallow-copied `Deck` with the two new fields on
`session`. `summary` folds `performed` and returns a defensive `[]` copy.

- [ ] **Step 4: Run to confirm they pass**

Run: `npx vitest run src/engine/deck.test.ts` — Expected: PASS (all engine
tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): perform/skip/defer/isDone/endSession/summary"
```

---

## Task 4: DAO + session persistence + first-open seed

**Files:**
- Create: `src/storage/db.ts`, `src/storage/seeds.ts`, `src/storage/db.test.ts`
- Test: `src/storage/db.test.ts`

**Interfaces:**
- Consumes (from Task 2 types): `Exercise`, `Variant`, `LogEntry`, `Session`,
  `Mode`, `Unit`.
- Produces (consumed by `src/service/session.ts` in Task 5):
  - `db: Dexie` — a singleton Dexie instance created with `exercises`, `logs`,
    and `sessions` tables.
  - `addExercise(input: Omit<Exercise, 'id' | 'createdAt'>, now: number): Promise<Exercise>`
  - `listExercises(): Promise<Exercise[]>`
  - `exercisesForPicker(): Promise<Exercise[]>` — alias for `listExercises`
    (kept named so the UI contract is explicit; v1 is identical).
  - `addLog(input: Omit<LogEntry, 'id' | 'performedAt'>, now: number): Promise<LogEntry>`
  - `logsForSession(sessionId: string): Promise<LogEntry[]>`
  - `getActiveSession(): Promise<Session | undefined>` — the most recent session
    with `status === 'active'`, sorted by `startedAt desc`, or `undefined`.
  - `saveSession(session: Session): Promise<void>` — upsert by `id`.
  - `startSession(session: Session): Promise<void>` — upserts; flips any prior
    active session (by `status==='active'`) to `status='ended'` with
    `endedAt===Date.now()` at start of this call, then persists the new one
    as `'active'`.
  - `endSession(sessionId: string, now: number): Promise<void>` — sets
    `status='ended'` and `endedAt=now` on that row.
  - `seedIfEmpty(now: number): Promise<void>` — when `exercises` is empty,
    bulk-insert `SEED_EXERCISES` with `createdAt===now`; no-op otherwise.

- `src/storage/seeds.ts` exports `SEED_EXERCISES: Omit<Exercise, 'id' | 'createdAt'>[]`
  (a builder call — see below for the exact 6-card seed set).

**Seed set (builder call; the partner's shape is 4 variants per card,
the specific content is mine to choose):**

- **Push-up** — L1 Wall push-up / L2 Incline push-up / L3 Floor push-up / L4 Decline push-up.
- **Squat** — L1 Chair squat / L2 Bodyweight squat / L3 Deep squat / L4 Pistol squat.
- **Pull-up** — L1 Chin-up / L2 Pull-up / L3 Wide-grip pull-up / L4 One-arm row progress.
- **Plank** — L1 Knee plank 20 s / L2 Full plank 45 s / L3 Side plank 30 s / L4 Weighted plank 60 s. (Labels reference seconds so the user toggles to `seconds` on the PerformPanel; no per-exercise unit field in v1 — a builder call.)
- **Dips** — L1 Bench dips / L2 Close-grip dips / L3 Wide-grip dips / L4 L-sit dips.
- **Lunge** — L1 Standing lunge / L2 Walking lunge / L3 Reverse lunge / L4 Split squat.

`howTo` for each: one sentence, action-oriented, e.g.
`{ level: 1, label: 'Knee plank 20 s', howTo: 'Forearms under shoulders, knees on the floor; hold 20 s and keep the core flat.' }`.

- [ ] **Step 1: Write the failing tests** (`src/storage/db.test.ts`)

Import `db`, `addExercise`, `listExercises`, `exercisesForPicker`,
`addLog`, `logsForSession`, `getActiveSession`, `saveSession`,
`startSession`, `endSession`, `seedIfEmpty`, `SEED_EXERCISES` from
`./db` and `./seeds`. Use the `fake-indexeddb` global set up in Task 1's
`vitest.config.ts` setup file. Before each test, `await db.delete().where('...')`
or open a fresh Dexie with a unique name per describe to isolate.

Assert (group by table / by Review Focus):

- **Exercises:** `addExercise({name:'Push-up', variants:[<4 variants>]}, 1000)` returns a row with a generated `id`, `createdAt===1000`; `listExercises()` returns it; `exercisesForPicker()` returns the same.
- **Logs:** `addLog({exerciseId:'a', variantLevel:1, count:10, unit:'reps', sessionId:'s1'}, 1000)` returns with generated `id`, `performedAt===1000`; `logsForSession('s1')` returns that row; `logsForSession('other')` returns `[]`.
- **Session lifecycle:**
  - `getActiveSession()` before anything → `undefined`.
  - `startSession(<a fresh deck's session>)` → `getActiveSession()` returns that session.
  - `startSession(<a second fresh session>)` → `getActiveSession()` returns the second; the first has `status==='ended'` and `endedAt` set (enforcing "one active at a time" per Global Constraints).
  - `endSession(sid, 5000)` → the session row has `status==='ended'`, `endedAt===5000`; **`logsForSession(sid)` still returns the same count** (ending a session never deletes its log rows — Review Focus / data-preservation guarantee).
- **Seeds:** on a fresh DB, `seedIfEmpty(1000)` fills `exercises` with
  `SEED_EXERCISES.length` rows; calling `seedIfEmpty` again is a no-op
  (`listExercises().length` unchanged).
- **Reload mid-session (Review Focus):** start a `shuffled` session from
  `['a','b','c']`, `perform` two cards via `addLog` (or through the engine +
  `saveSession`), `saveSession(session)` after two performances so
  `queue`=`['c']`; then `getActiveSession()` returns a session with
  `queue=['c']` and `logsForSession(id)` returns the two `LogEntry` rows —
  state matches what was saved.

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/storage/db.test.ts` — Expected: FAIL
("cannot find module './db'").

- [ ] **Step 3: Implement `seeds.ts`, then `db.ts`**

`seeds.ts` is a literal `SEED_EXERCISES` array matching the 6-card list above
(names + 4 variants each; each variant `howTo` is one sentence as sketched).

`db.ts`:
- `new Dexie('calisthenics-v1')` with three `Table`s keyed by `id` and
  indexed by `exerciseId`/`sessionId` on `logs`, and `startedAt` on `sessions`.
- Each DAO function is a thin wrapper over `db.<table>.add|put|get|where|toArray`.
- `startSession` opens a single `db.transaction('rw' as [tables])` to be atomic:
  flip all rows where `status==='active'` to `'ended'` with `endedAt===now`
  (passed as an arg), then `put` the new one. No `Date.now()` inside the
  function — takes a `now: number` for testability; the caller
  (`service/session.ts`, Task 5) passes `Date.now()`.
- No `any` in `db.ts` (per Global Constraints).
- `seedIfEmpty` checks `await db.exercises.count() === 0` before inserting,
  to avoid duplicate seeding across reloads.

- [ ] **Step 4: Run to confirm they pass**

Run: `npx vitest run src/storage/db.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(storage): Dexie DAO, session lifecycle, first-open seed set"
```

---

## Task 5: Service glue — `service/session.ts`

**Files:**
- Create: `src/service/session.ts`, `src/service/session.test.ts`
- Test: `src/service/session.test.ts`

**Interfaces:**
- Consumes (from Tasks 2–4): every engine function (`startSession`, `perform`,
  `skip`, `defer`, `isDone`, `endSession`, `summary`, `nextCard`); every DAO
  function (`addExercise`, `listExercises`, `exercisesForPicker`, `addLog`,
  `logsForSession`, `getActiveSession`, `saveSession`, DAO `startSession`,
  DAO `endSession`, `seedIfEmpty`); the `Exercise`, `Variant`, `LogEntry`,
  `Session`, `Deck`, `Mode`, `Unit` types.
- Produces (consumed by every React component in Tasks 6–9):
  - `loadCurrentSession(): Promise<Deck | undefined>` — reads
    `getActiveSession()` + `logsForSession(active.id)` and returns the
    combined `Deck`, or `undefined` when no active session exists.
  - `startNewSession(mode: Mode, exerciseIds: string[]): Promise<Deck>` —
    engine `startSession`, then DAO `startSession` (which atomically ends any
    previous active session, per Task 4), and returns the new deck.
  - `applyAction(deck: Deck, action: PerformAction | SkipAction | DeferAction): Promise<Deck>`
    where
    ```ts
    type PerformAction = { kind: 'perform'; exerciseId: string;
                           variantLevel: 1|2|3|4;
                           count: number; unit: Unit };
    type SkipAction    = { kind: 'skip';    exerciseId: string };
    type DeferAction   = { kind: 'defer';   exerciseId: string };
    type Action = PerformAction | SkipAction | DeferAction;
    ```
    — runs the engine function, then for `perform` also calls `addLog` for
    the new entry, then calls `saveSession(deck.session)` for **every**
    action (so queue changes survive reload). Returns the updated `Deck`.
  - `endSessionNow(deck: Deck): Promise<void>` — engine `endSession(deck,
    Date.now())`, then DAO `endSession(deck.session.id, Date.now())`.
  - `addExercise(input: Omit<Exercise, 'id' | 'createdAt'>): Promise<Exercise>`
    — DAO `addExercise(input, Date.now())` (lets `App` add exercises through
    the service so the UI never imports the DAO directly).
  - `exercisesForPicker(): Promise<Exercise[]>` — DAO `exercisesForPicker()`.
  - `seed(): Promise<void>` — DAO `seedIfEmpty(Date.now())`.
  - Every async function calls `Date.now()` exactly once at entry. Tests
    use a `vi.useFakeTimers()` + advance for deterministic expected `now`
    values.
- No `any` in `service/session.ts` (Global Constraints).

- [ ] **Step 1: Write the failing tests** (`src/service/session.test.ts`)

Import from `./session`. Use the real DAO (fake-indexeddb is already on in
Task 1's setup). Before each describe, open a fresh Dexie (`db.delete()`,
`db.open()`) to isolate.

Assert:
- `seed()` on empty — `listExercises().length === SEED_EXERCISES.length`;
  second `seed()` is a no-op (`listExercises().length` unchanged).
- `loadCurrentSession()` returns `undefined` on a fresh DB.
- After `startNewSession('ordered', ['a','b','c'])`:
  - the returned `Deck.session.queue` is `['a','b','c']` (ordered);
  - `loadCurrentSession()` returns a deck with the same `session.queue`,
    `performed=[]`, and `session.startedAt === frozenNow` (fake timers).
- `applyAction(deck, {kind:'perform', exerciseId:'a', variantLevel:2, count:10, unit:'reps'})`:
  - returned `Deck.performed.length === 1` with the exact `LogEntry`;
  - `Deck.session.queue` no longer contains `'a'`;
  - `loadCurrentSession()` returns a deck with the same `performed` (the
    entry was persisted via `addLog`); the queue change was persisted via
    `saveSession`.
- **Start-a-new-session ends the prior one** (data-preservation):
  start session A with 2 logs in it, start session B (empty), `loadCurrentSession()`
  returns B, then `logsForSession(A.id)` still returns 2 rows. This
  pins the "one active at a time" enforcement AND the "data-preservation on
  end" guarantee together at the service layer.
- `endSessionNow(deck)` — after the call, `loadCurrentSession()` returns
  `undefined` (no active session anymore), but `logsForSession(deck.session.id)`
  still returns its performed log rows.
- **Reload mid-session** (Review Focus): start a `shuffled` session with
  `['a','b','c']`, call `applyAction` for two performs, then in a fresh
  `describe` (simulating a page reload — call `db.delete()` then open
  fresh, then `loadCurrentSession()`), the returned deck's queue has length
  1 and `performed.length === 2`; the two `LogEntry` rows reappear with
  identical `id`, `count`, `unit`, `sessionId`.

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/service/session.test.ts` — Expected: FAIL
("cannot find module './session'").

- [ ] **Step 3: Implement `src/service/session.ts`**

Each function is a two- or three-line composition. `applyAction` switches on
`action.kind`, calls the corresponding engine function, and (for `perform`
only) calls `addLog` before `saveSession`. No branching on mode here — mode
is baked into the `Deck` returned by the engine. No mutation. `Date.now()`
called once per entry to the DAO; engine-side functions get the same
`now` value for consistency.

Engine and DAO both export `startSession` and `endSession` with different
signatures — import the engine functions under distinct local names
(e.g. `engineStartSession`, `engineEndSession`) to avoid a same-name clash
inside `service/session.ts`.

- [ ] **Step 4: Run to confirm they pass**

Run: `npx vitest run src/service/session.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(service): session glue over engine + DAO"
```

---

## Task 6: Card flow — `PerformPanel` and `CardView`

**Files:**
- Create: `src/components/PerformPanel.tsx`, `src/components/PerformPanel.test.tsx`, `src/components/CardView.tsx`, `src/components/CardView.test.tsx`
- Modify: `src/engine/types.ts` (add `unit?: Unit` to `Exercise` — small additive builder call, no breaking change; engine and storage tests are rerun to confirm)
- Test: the two `*.test.tsx` files

**Interfaces:**
- Consumes: `Exercise`, `Variant`, `Unit`, `Mode` (from Task 2 types).
- Produces:
  - `PerformPanel` — props `{ variants: Variant[]; defaultUnit?: Unit; onConfirm: (variantLevel: 1|2|3|4, count: number, unit: Unit) => void; onCancel: () => void }`.
    - Renders one button per available variant (only 1..N that exist, in `level` order — no blanks); pre-selects the first.
    - A numeric `count` stepper (default 1, floor at 1).
    - A `unit` toggle: `reps` / `seconds`, defaulting to `props.defaultUnit ?? 'reps'`.
    - `Confirm` fires `onConfirm(selectedLevel, count, unit)`.
    - `Cancel` fires `onCancel`.
  - `CardView` — props `{ exercise: Exercise; mode: Mode; onPerform: () => void; onSkip: () => void; onDefer?: () => void }`.
    - Renders `exercise.name`, `exercise.equipment` (if present), all variant labels (`L{n}: {label}` for each), and the three action buttons.
    - Defer button **is not rendered** when `mode === 'free-select'` (per Review Focus and per DESIGN.md §UI).
    - Perform opens the `PerformPanel` overlay; onConfirm bubbles through to the parent via the parent's `onPerform` + a callback — `CardView` receives `onPerformed(exerciseId, level, count, unit)` (not the raw `onPerform` which just toggles the overlay). So the actual signature is:
      - `CardView` props: `{ exercise: Exercise; mode: Mode; onPerformed: (exerciseId: string, level: 1|2|3|4, count: number, unit: Unit) => void; onSkip: () => void; onDefer?: () => void }`.
      - `CardView` owns the open/close state of the `PerformPanel` internally; `onSkip`/`onDefer` bubble straight through.

- [ ] **Step 1: Extend the type & write the failing tests**

First update `src/engine/types.ts` to add `unit?: Unit` to `Exercise` (no
breaking change; existing engine/storage tests still pass — re-run to
confirm). Then write the RTL tests using `@testing-library/react` +
`@testing-library/user-event`. Use `vi.fn()` for callback props.

`PerformPanel.test.tsx`:
- Renders N variant buttons for N variants, labels only the existing levels (no blank button for missing levels).
- Default count is 1; stepping up shows 2.
- `defaultUnit='seconds'` shows the toggle on "seconds"; default (no prop) shows "reps" active.
- Clicking `Confirm` fires `onConfirm(selectedLevel, count, unit)` — assert the exact call arguments.
- Clicking `Cancel` fires `onCancel`.
- Toggling unit before Confirm changes the `unit` argument passed.

`CardView.test.tsx`:
- Renders `exercise.name`, `equipment` (when provided; absent when undefined), and one row per variant label.
- `mode='ordered'` → the Defer button is in the DOM; clicking it invokes `onDefer`.
- `mode='shuffled'` → same.
- `mode='free-select'` → the Defer button is **not in the DOM at all** (Review Focus; use `screen.queryByText('Defer')` to assert `null`).
- Clicking Perform opens the `PerformPanel`; clicking Confirm in it invokes `onPerformed` with the chosen values.
- `onSkip` is invoked when the Skip button is clicked.

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/components/PerformPanel.test.tsx src/components/CardView.test.tsx` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the two components**

`PerformPanel`: local state for `selectedLevel` (defaulting to the lowest
present `level`), `count` and `unit`. No engine/DAO imports. Pure presentation.

`CardView`: local state for `panelOpen: boolean`. Renders variant labels from
`exercise.variants` and the action row; renders `PerformPanel`
conditionally; `PerformPanel.onConfirm` calls the parent's `onPerformed`
and closes the panel, `onCancel` closes the panel.

- [ ] **Step 4: Run to confirm they pass**

Run: `npx vitest run src/components/PerformPanel.test.tsx src/components/CardView.test.tsx` — Expected: PASS. Also re-run `npx vitest run src/engine/deck.test.ts src/storage/db.test.ts src/service/session.test.ts` to confirm the `unit?: Unit` addition didn't break anything — Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): PerformPanel + CardView with free-select Defer suppression"
```

---

## Task 7: Deck assembly — `ModePicker` and `CardPicker`

**Files:**
- Create: `src/components/ModePicker.tsx`, `src/components/ModePicker.test.tsx`, `src/components/CardPicker.tsx`, `src/components/CardPicker.test.tsx`
- Test: the two `*.test.tsx` files

**Interfaces:**
- Consumes: `Exercise`, `Mode` (from Task 2 types); `exercisesForPicker`
  shape returned by `service/session.ts` (`Exercise[]`).
- Produces:
  - `ModePicker` — props `{ onPick: (mode: Mode, exerciseIds: string[] | undefined) => void }` and internal "which cards" selection.
    - For `'ordered'` or `'shuffled'`: renders a multi-select of available
      exercises (checkboxes / multi-tap) plus 3 mode buttons.
    - For `'free-select'`: no card selection — a single button that
      immediately fires `onPick('free-select', undefined)`.
    - Default card selection: **all** available exercises (per DESIGN.md
      builder call). No localStorage; no persisting last selection in v1.
  - `CardPicker` — props `{ exercises: Exercise[]; onPick: (exerciseId: string) => void }`.
    - Used by `App.tsx` in `free-select` mode: scrollable list of
      `exercises`; tap → `onPick(id)`. No "skip entirely" action (skip
      would just not tap a card). No "defer" (per Design: free-select has
      no queue, no bottom).

- [ ] **Step 1: Write the failing tests**

Both use `@testing-library/react` + `@testing-library/user-event`.
`vi.fn()` for all callbacks.

`ModePicker.test.tsx`:
- Renders 3 mode options (Ordered / Shuffled / Free-select).
- Tapping Free-select fires `onPick('free-select', undefined)` — no
  exercise selection happens.
- In Ordered mode after selecting 2 of 3 available exercises (toggle a
  checkbox on/off), tapping the "Start" button fires
  `onPick('ordered', ['a','b'])` with the exact ids.
- In Shuffled mode, same pattern: 2 of 3 selected → `onPick('shuffled',
  ['a','b'])`.
- **Default selection on first render is all exercises**: assert that
  tapping `Start` with no toggles fires `onPick('ordered',
  ['a','b','c'])`.

`CardPicker.test.tsx`:
- Renders one row per passed exercise.
- Clicking an exercise row calls `onPick` with the exact `id`.
- Rendering with 0 exercises shows an empty-state label (no crash);
  rendering with 1 exercise shows just that one.

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/components/ModePicker.test.tsx src/components/CardPicker.test.tsx` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the two components**

`ModePicker`: local state `mode: Mode`, `selectedIds: Set<string>`
(defaulting to the full list of ids passed in). Renders mode tabs with
one "Start" button per mode; toggling the card checkbox updates
`selectedIds`. For `free-select`, the button fires immediately without
reading `selectedIds`. No engine/DAO imports.

`CardPicker`: dumb list-render — one button per `exercise`; each
button carries `data-exercise-id={exercise.id}` so tests can find
it. No other state needed.

- [ ] **Step 4: Run to confirm they pass**

Run: `npx vitest run src/components/ModePicker.test.tsx src/components/CardPicker.test.tsx` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): ModePicker + CardPicker"
```

---

## Task 8: Session close and authoring — `SessionSummary` and `AddExerciseForm`

**Files:**
- Create: `src/components/SessionSummary.tsx`, `src/components/SessionSummary.test.tsx`, `src/components/AddExerciseForm.tsx`, `src/components/AddExerciseForm.test.tsx`
- Test: the two `*.test.tsx` files

**Interfaces:**
- Consumes: `Deck`, `summary(deck)` (from Task 3 engine), `Exercise`, `Variant`, `Unit`, `addExercise` DAO shape (from Task 4).
- Produces:
  - `SessionSummary` — props `{ deck: Deck; onStartNew: () => void }`.
    - Renders `summary(deck).sets`, `totalReps`, `totalSeconds`, and a list
      of `items` with exercise name, `L{n}`, count, and unit per row.
    - A "Start new session" button fires `onStartNew`.
    - Empty-deck case (`sets === 0`): no crash; shows "No sets logged"
      label + the `onStartNew` button only.
  - `AddExerciseForm` — props `{ onSaved: (ex: Omit<Exercise, 'id' | 'createdAt'>) => void }`.
    - Renders a `name` input, optional `equipment` input, and up to 4 variant rows (label + howTo, each with a "clear to blank" toggle so partial authoring is allowed).
    - "Save" fires `onSaved` with the assembled object, **skipping empty
      variant rows** (so `variants` has only the filled-in levels).
    - `name` is required. Saving with empty `name` does not fire `onSaved`
      (button disabled — test asserts disabled state).

- [ ] **Step 1: Write the failing tests**

Both use `@testing-library/react` + `@testing-library/user-event`.
`vi.fn()` for callbacks.

`SessionSummary.test.tsx`:
- `summary(deck).totalReps === 0, totalSeconds === 0` — only "No sets
  logged" label renders, the `onStartNew` button does.
- `summary(deck) = { sets: 3, totalReps: 25, totalSeconds: 60, items:
  ... }` — each row shows its exercise name, level, count, and unit,
  and `totalReps: 25` / `totalSeconds: 60` are both visible.
- Clicking "Start new session" fires `onStartNew`.

`AddExerciseForm.test.tsx`:
- Empty form: the `Save` button is disabled (query by role, assert
  `disabled`).
- Filling in just `name` (no variants) → `Save` becomes enabled →
  `onSaved` called with `{ name, variants: [] }`.
- Filling `name` and 2 variant rows (label + howTo) → `onSaved` called
  with `variants.length === 2` and the exact fields.
- Filling 2 rows but leaving level-1 blank and level-3 blank →
  `onSaved` called with `variants.length === 1` containing only the
  one filled row; the skipped level's fields are not present.
- Editing a variant row's `howTo` after save does not re-fire `onSaved`
  until `Save` is clicked again.

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/components/SessionSummary.test.tsx src/components/AddExerciseForm.test.tsx` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the two components**

`SessionSummary`: derive from `summary(deck)`; render items list. No
engine/DAO imports beyond `summary`.

`AddExerciseForm`: local state
`{name: string; equipment: string; variants: (Variant | null)[]}`
initialized to 4 null slots. A row is "filled" iff both `label` and
`howTo` are non-empty. On save: strip null slots and emit. Disable `Save`
when `name.trim() === ''`.

- [ ] **Step 4: Run to confirm they pass**

Run: `npx vitest run src/components/SessionSummary.test.tsx src/components/AddExerciseForm.test.tsx` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): SessionSummary + AddExerciseForm"
```

---

## Task 9: App wiring, PWA shell, offline smoke

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`, `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `vite.config.ts`, `src/App.test.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: every component (Tasks 6–8), every function from
  `service/session.ts` (Task 5), the `Exercise`, `Mode`, `Deck`, `Unit`
  types.
- Produces: the single-page app; `App.tsx` holds one reducer-style state:
  ```ts
  type Screen =
    | { kind: 'loading' }
    | { kind: 'start'; exercises: Exercise[] }
    | { kind: 'card'; deck: Deck; currentId: string | null }   // 'currentId' is what's on the card right now
    | { kind: 'summary'; deck: Deck }
    | { kind: 'add-exercise'; exercises: Exercise[] };
  ```
  `App` routes between those five screens.

- [ ] **Step 1: Write the failing tests** (`src/App.test.tsx`)

Use `@testing-library/react` + `@testing-library/user-event`. Import
`service/session.ts` — the tests use the real DAO in fake-indexeddb
(Task 1's setup).

Assert the two Review-Focus paths end-to-end through the app:
- **Reload mid-session** — simulate by calling `App.loadCurrentSession`
  after seeding an active session with a half-empty queue; when
  `App` mounts, it renders `card` not `start` when the queue is
  non-empty, and `summary` when the queue is empty.
- **Free-select hides Defer** — `App` renders `CardView` with
  `mode='free-select'`; assert `'Defer'` text is **not** in the DOM
  (same assertion, at the App layer, to catch a regression where
  `App` passes the wrong `mode` prop).
- **Seed on fresh DB** — fresh state: `App` shows `start` after
  `seed()` fills the 6-card exercise set; first tap on
  "Start session" (default = all cards + ordered) renders `card`
  with the first exercise in the ordered list.
- **CardView → summary** — ordered deck from `[a,b,c]`, perform all 3 →
  `isDone(deck) === true` → `App` renders `summary` showing
  `sets: 3` and per-set rows.
- **Free-select: user taps End** — `App` shows a persistent
  "End session" button; tapping it fires `endSessionNow(deck)`
  and transitions to `summary`.
- **Add exercise** — from `start`, tapping "Add exercise" (a
  small link/button next to "Start session") routes to `add-exercise`;
  saving via `AddExerciseForm` persists via `addExercise` and
  transitions back to `start` with the new exercise in the list.
- **Reload mid-session through the whole app** — after 2 of 3
  performs, call `screen.unmount()` then `render(<App/>)` again
  (simulate a reload); assert the card shown is the 3rd exercise and
  the `summary` screen is not visible — i.e., `loadCurrentSession`
  resumes mid-deck.

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/App.test.tsx` — Expected: FAIL (the App is a
stub after Task 1).

- [ ] **Step 3: Implement `App.tsx`**

The reducer-style state machine above. `App` does **not** call
`Date.now()` itself — every engine / DAO call that needs a timestamp
receives it from the service layer. `App` calls
`{loadCurrentSession, startNewSession, applyAction, endSessionNow,
seed, addExercise, exercisesForPicker}` (the last two are direct
DAO wrappers, called through `service/session.ts` to keep the UI's
dependency surface flat).

On mount:
- First call `await seed()` (no-op after first time);
- Then `const deck = await loadCurrentSession()`; if `deck ===
  undefined`, transition to `start` with
  `exercisesForPicker()`. Else branch on `deck.session.mode`:
  - `'free-select'` → render `CardPicker` with
    `exercisesForPicker()` (free-select has no queue, so
    `CardView` is not rendered for it).
  - `'ordered'` or `'shuffled'` with `isDone(deck)` (empty queue)
    → transition to `summary`.
  - `'ordered'` or `'shuffled'` with a non-empty queue → transition
    to `card` with `currentId = nextCard(deck)` (guaranteed non-null
    when the queue is non-empty).

**PWA shell** (sub-step of Step 3, or a parallel build step):
- `vite.config.ts`: add `vite-plugin-pwa` with `workbox` that
  precaches `index.html`, the JS/CSS bundle, and the two icons
  (already in `public/`). Set `dev: false` in the PWA config so
  dev-mode keeps iterating fast while build-mode is offline.
- `public/manifest.webmanifest`: 2 icons, 192×192 and 512×512
  (placeholder PNGs generated via a 1-line script: a 512×512 PNG
  with a simple icon and a 192×192 downscale). `name: 'Exercise
  Cards'`, `short_name: 'ExCards'`.
- `index.html`: meta tags for `theme-color` and
  `mobile-web-app-capable: yes`, link `manifest.webmanifest` via
  `<link rel="manifest">`.
- `public/sw.js`: generated by `vite build` (no manual edits).

- [ ] **Step 4: Run to confirm they pass**

- `npx vitest run` — Expected: every `*.test.{ts,tsx}` in
  `src/**` PASSES.
- `npx vite build` — Expected: builds cleanly, `dist/` contains
  `sw.js` + generated PWA manifest.
- `npx vite preview --port 4173 &` then manually open the URL in
  Chrome and confirm:
  - first open shows `start` with 6 seeded exercises.
  - `chrome://serviceworker` shows the app's service worker.
  - DevTools Application → "Add to Home Screen" prompt appears
    (or the icon shows in the mobile device mode).
  - **Network tab → Offline checkbox on** — reload; app still
    renders and the `card` you were on is there.
- If any assertion in Step 4 fails, fix in a small commit.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): wire screens + PWA offline shell, end-to-end smoke"
```

---

## Self-review

After all 9 tasks are green, walk through `DESIGN.md` and
`PLAN.md` side by side and confirm each bullet maps to a task:

- [x] Ordered / Shuffled / Free-select → Task 2 `buildQueue`,
      Task 3 `isDone` mode-aware, Task 6 `CardView` free-select
      Defer suppression, Task 7 `ModePicker` / `CardPicker`.
- [x] 4 variants per movement → Task 4 seed list; Task 6
      `PerformPanel` renders available variants only.
- [x] Perform + count + unit → Task 3 `perform`; Task 6
      `PerformPanel` unit toggle.
- [x] Skip entirely / Skip for now → Task 3 `skip` / `defer`.
- [x] Free-select defer is N/A → Task 6 `CardView` hides Defer in
      free-select mode; Task 7 `CardPicker` docs.
- [x] On-device persistence → Task 4 `db.ts`, Task 5 reload
      mid-session.
- [x] Session resumes across launches → Task 5 `loadCurrentSession`
      + Test `reload-mid-session` in `service/session.test.ts` and
      `App.test.tsx`.
- [x] Start new / End session user-controlled → Task 4 DAO
      `startSession`/`endSession`, Task 5 service wrappers,
      Task 8 `SessionSummary` "Start new session" button; Task 9
      persistent "End session" button.
- [x] Add new exercise → Task 4 `addExercise`, Task 8 form.
- [x] Seeded on first open → Task 4 `seedIfEmpty`, Task 9 mount.
- [x] Cross-session history — a non-goal for v1; its data (the
      `LogEntry` rows) is preserved (Task 4 `endSession` never
      deletes them; Task 5 `loadCurrentSession` after an end
      returns `undefined`).

**Review Focus check** (5 items from the header):
1. Reload mid-session — Task 4 + Task 5 + Task 9 (`src/service/session.test.ts`
   "reload mid-session through the whole app").
2. Hold unit — Task 6 `PerformPanel` test with `defaultUnit='seconds'`
   (Plank in the seed); Task 8 `SessionSummary` totals render
   `totalSeconds`.
3. Deferred last card — Task 3 `defer` "already-last is no-op,"
   `isDone` on empty queue.
4. Shuffle preserves multiset — Task 2 `buildQueue('shuffled')`
   including N=1, N=0.
5. Free-select never auto-ends + no Defer — Task 3 `isDone`
   `free-select` → always `false`; Task 6 `CardView` hides Defer;
   Task 9 "Free-select: user taps End" test.

---

## Execution Hand-Off

- **Recommended approach:** **Subagent-driven development**.
  Rationale: 9 tasks with a clean engine/service/DAO/UI dependency
  order, well-defined Interfaces blocks in each task, and each task
  ends with a test cycle — that's the exact shape subagent-driven
  development is built for (fresh context per task, per-task
  reviewer gate, and a single whole-branch review at the end).
- **Fallback if subagent-driven isn't available:** **Native**
  (this harness runs each task in turn, one whole-branch review at
  the end).

**REQUIRED SUB-SKILL on execution:**
`superpowers:subagent-driven-development` (or
`superpowers:executing-plans` if the native path is chosen).

The plan is saved at `calisthenics/PLAN.md`. The spec it implements
is at `calisthenics/DESIGN.md`.

