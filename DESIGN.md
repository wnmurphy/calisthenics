# Exercise Cards — Design

> Status: draft for partner review. Date: 2026-10-16.

A phone app (PWA) that suggests calisthenics exercises as cards when you're
stuck on what to do, and logs what you actually performed. Everything runs
offline, on device, with no account or backend.

## Intent & why

Two moments to serve:

1. **"I want to move but I can't think of what"** — the app hands you the next
   exercise card instead of leaving you standing there deciding.
2. **"Afterward, just tell me what I did"** — the app records each
   performed set (exercise, which variant, how many, and in what unit) so it
   exists later.

Location is irrelevant: the same calisthenics set works at the gym, on a
track, or at home. The app must work on whatever device is in the hand, with
no signal.

## Goals (v1)

- A working "deck" of exercise cards to move through during a session, with
  three ways the next card is chosen:
  - **Ordered** — work the deck top-to-bottom in a fixed order.
  - **Shuffled** — same deck, randomized order.
  - **Free-select** — no fixed queue; at each step you are offered all cards
    and pick which to perform next.
- Each card carries **four difficulty variants** of one movement, easiest →
  hardest (e.g. Push-up: wall → incline → floor → handstand-push-up).
- Per card, three outcomes:
  - **Perform** — log it: pick which of the 4 variants, how much, and the
    unit (`reps` or `seconds`).
  - **Skip entirely** — discard this card, move to the next.
  - **Skip for now (defer)** — push this card to the bottom of the deck,
    move to the next.
- When a queue mode's deck is empty, show a **session summary** of what was
  logged.
- **On-device persistence** — exercises, performed sets, and the *active
  session* (its remaining queue and what's been performed) survive reload and
  app close.
- **A session is resumable and user-controlled.** Reopening the app continues
  the session where it left off. The user explicitly **ends** a session and
  **starts a new** one — sessions do **not** reset on every launch.
- Each performed set is logged with a **count and a unit** — `reps` for
  normal movements, `seconds` for holds (e.g. Plank).
- **Add a new exercise** (with its 4 variants) at any time.
- A small **seeding set** of exercises so the app is useful on first open.

## Non-goals (v1)

- Watching history/streaks/trends across sessions back. Data is recorded and
  persisted for later, but the cross-session history view is a future screen.
- Accounts, sync, cloud, multi-device.
- Timers that pause/resume around sets, rest tracking beyond counting hold
  seconds, weight/resistance tracking (beyond a freeform note).
- Custom decks saved as named presets, templates, or scheduled plans.
- Native binary packaging / app-store submission.

## Anti-goals (what would make this "work" but still fail)

- A deck that's painful to *re-open* — reopening must **resume** where you
  left off; no re-choosing all the mode plumbing every time.
- Logging friction — the "perform" path must be one or two taps to finish,
  because you are possibly out of breath or between sets.
- Anything that needs a network at runtime.

## Constraints

- **Offline + on-device + portable.** PWA installable to the home screen;
  works with no connectivity; all state in local storage.
- **Node 18** is the runtime on the build box. The stack is pinned to versions
  that run on Node 18.15 (notably: Vite **5**, not 6/7).
- **TDD.** Tests written first (Vitest); the deck logic is a pure, DOM-free
  module so it can be exhaustively driven without a browser.
- **Local-only.** No server, no network calls at runtime, no external data.

## Decisions the partner made (their calls)

- **Card = one movement, 4 variants.** The 4 versions are scaling variants of
  the *same* movement, easiest→hardest. Logging records *which* variant, a
  *count*, and the *unit*.
- **PWA.** Phone-app feel, installable, offline, no backend.
- **Data persists on device.**
- **Cross-session history is deferred** — progressive enhancement, not v1.
  (The *active* session, however, does resume across launches.)
- **Add new exercise** is in scope.
- **A session is a working deck** of cards; it resumes on reopen.
- **Count + unit per performed set.** `unit` is `reps` or `seconds`, so holds
  (Plank) log in seconds with no special case.
- **Sessions are user-controlled and resumable.** Reopening continues the
  active unfinished session; the user **ends** a session explicitly and
  **starts** a new one. There is **no** "fresh session on every launch."

## Decisions the builder made (my calls — review these)

- **Stack:** Vite 5 + React 18 + TypeScript, Vitest (+ jsdom / RTL for
  components), Dexie.js for IndexedDB persistence, Workbox for the offline
  service worker. Chosen as the leanest stack that still gives a real
  phone-offline feel *and* a fast, strict TDD loop.
- **Folder:** new top-level `calisthenics/` directory. `git init` at its root,
  using the build box's **existing git identity** (no dummy user.email/name).
- **Deck engine as pure logic.** The heart of the app (build order, shuffle,
  defer-to-bottom, skip, empty-detection, session start/end) is a set of pure
  functions operating on plain state. UI and storage are thin shells over it.
  This is what makes TDD cheap.
- **One active session at a time.** v1 holds a single resumable session;
  starting a new session ends the active one (or ends it when the user
  requests). Ending never deletes the session's data — its performed sets are
  still logged (for the future history view).
- **Free-select & defer semantics.** Defer-to-bottom and skip apply to the
  *queue* (ordered/shuffled) modes. In free-select there is no fixed queue
  "bottom," so "skip for now" simply means "don't pick it this turn" — the
  picker just re-opens. Free-select still records performances.
- **Modes end differently.** Ordered/shuffled sessions end when the queue is
  empty *or* when the user taps "End session." Free-select ends only by user
  action ("End session"), since its queue isn't preloaded.
- **Variants are optional to populate per level.** A new exercise must supply a
  name; its variants are filled in as the user authors them. A blank level is
  simply not offered. Authoring enforces at most one variant per level
  (1–4), matching the "4 versions" model.
- **Ordered mode's default deck is "all exercises," and remembers your last
  selection** — so re-opening a new session is one tap, not a re-pick (guards
  the re-open anti-goal).
- **Session summary is minimal:** sets performed, total reps, total hold
  seconds, and the list of (exercise, variant, count, unit) performed this
  session. Rendered from the session's LogEntry rows.
- **Seeding set:** a handful of common calisthenics movements (e.g. Push-up,
  Squat, Pull-up, Plank, Dips, Lunge, each with up to 4 realistic variants)
  loaded on first open when the store is empty. Plank seeds with `seconds`-
  based variants. The exact list and label/`howTo` text the builder picks are
  builder calls; the *shape* is the partner's.
- **Identifier & time:** UUIDs for ids; timestamps from the device clock.

## Data model (Dexie / IndexedDB)

Three tables.

**Exercises**
```
Exercise {
  id: string            // uuid
  name: string          // the movement, e.g. "Push-up"
  equipment?: string    // e.g. "pull-up bar", "none"
  variants: Variant[]   // length 0–4, at most one per level, easiest → hardest
  createdAt: number     // device epoch ms
}
Variant {
  level: 1 | 2 | 3 | 4
  label: string         // e.g. "Wall push-up"
  howTo: string         // short instruction for that variant
}
```

**Logs** (performed sets — the data behind the future history view)
```
LogEntry {
  id: string            // uuid
  exerciseId: string
  variantLevel: 1 | 2 | 3 | 4
  count: number         // the number performed
  unit: 'reps' | 'seconds'
  performedAt: number   // device epoch ms
  sessionId: string     // groups a run together
}
```

**Sessions** (the user controls start/end; the active one resumes on launch)
```
Session {
  id: string            // uuid
  mode: 'ordered' | 'shuffled' | 'free-select'
  queue: string[]       // remaining exercise ids, in present order
  status: 'active' | 'ended'
  startedAt: number
  endedAt?: number
}
```

The Session row **is** the deck state that must survive a reload: its `queue`
restores the live deck position and `mode`, and the session's performed sets are
the `LogEntry` rows carrying its `sessionId`. On launch the app reads the
active session (if any) to resume; otherwise it offers to start a new one.

Storage layer is a thin async DAO over Dexie:
`addExercise`, `listExercises`, `exercisesForPicker`, `addLog`, `logsForSession`,
`getActiveSession`, `saveSession`, `startSession`, `endSession`. DAO tests run
against Dexie directly (with `fake-indexeddb` in Node), so no browser is needed
for them.

## The deck engine (pure, DOM-free, the most-tested module)

State (the in-memory form of a `Session` row):
```
Deck {
  session: Session               // mode + queue + status
  performed: LogEntry[]          // this session's logs
}
```

Functions (each pure, each unit-tested):
- `buildQueue(exerciseIds, mode)` — `ordered` keeps input order; `shuffled`
  returns a permutation; `free-select` produces an empty queue (cards come from
  the picker).
- `startSession(exerciseIds, mode)` — an active `Session` built from
  `buildQueue(...)`. The user's "Start new session."
- `nextCard(deck)` — the front of the queue; in free-select, "next" is
  "awaiting selection."
- `perform(deck, exerciseId, variantLevel, count, unit)` — appends a `LogEntry`,
  removes that card from the queue.
- `skip(deck, exerciseId)` — removes the card from the queue (discarded).
- `defer(deck, exerciseId)` — moves the card from front to **bottom** of queue.
- `isDone(deck)` — queue empty in ordered/shuffled; false in free-select.
- `endSession(deck)` — sets `status: 'ended'`, `endedAt`; the user's explicit
  "End session" (allowed in any mode).
- `summary(deck)` — `{ sets, totalReps, totalSeconds, items: LogEntry[] }` for
  the summary screen.

Invariants the tests pin: defer never changes *which* cards remain, only their
order; skip removes exactly one card; a shuffled queue has the same multiset as
its input; `perform` in a queue doesn't leave a card that a free-select run
would re-offer (mode-aware); ending a session never removes its performed
`LogEntry` rows.

## UI flow / screens

Components (React). Logic lives in the engine + DAO; components are thin.

1. **Launch** — first open seeds the exercise set. If an active session
   exists, **resume it** (queue + mode restore straight into CardView). If
   none, offer **Start new session** → mode pick.
2. **ModePicker** (only for new sessions) — choose Ordered / Shuffled /
   Free-select. For queue modes, also which cards this session; default to all
   exercises, remembering the last selection. Free-select needs no queue.
3. **CardView** — the current card: exercise name, equipment, the available
   variant rows (tappable to select a variant), and 3 actions: Perform / Skip /
   Defer (Defer hidden in free-select, where it's meaningless). One tap on
   Perform opens the reps/seconds input.
4. **PerformPanel** — variant (pre-selecting the last used, changeable) + a
   count + unit toggle (`reps` | `seconds`) → confirm logs and advances.
   One or two taps end-to-end for an exercise the user has done before.
5. **CardPicker** (free-select + deck building) — a scrollable list of all
   exercises to choose next / which cards to include.
6. **SessionSummary** — shown when a queue empties *or* the user taps
   "End session": sets performed, total reps, total hold seconds, and the
   performed list. CTA **Start new session**.
7. **AddExercise form** — name + up to 4 variants (label + howTo each, at most
   one per level). Reaches into the DAO; picker/CardView then show it.

Session controls: a persistent "End session" affordance during a session, and a
"Start new session" affordance on the summary and on launch when no session is
active. Reopening never silently starts a new session — it resumes the active
one.

Keep navigation to one primary stack; never more than the above on screen.

## PWA / offline

- **Web app manifest** + icons → installable to the home screen, standalone
  view.
- **Workbox** injects a service worker that pre-caches the app shell and assets
  for full offline use. No `fetch` to the network at runtime; all reads/writes
  are local.
- **IndexedDB (Dexie)** is the source of truth for exercises, logs, and the
  active session; it survives reload/close and is unaffected by offline status.

## TDD plan (order of construction; details land in superpowers:writing-plans)

1. **Deck engine** — pure functions, Vitest, full coverage of invariants. No DOM.
2. **DAO / storage** — Dexie + `fake-indexeddb`; add/list exercise, add log,
   logs-for-session, and session lifecycle (`getActiveSession`, `saveSession`,
   `startSession`, `endSession`); seed-on-first-open.
3. **Components, bottom-up**, React Testing Library: PerformPanel → CardView →
   ModePicker → CardPicker → SessionSummary → AddExercise.
4. **Wiring + PWA shell** — manifest, service worker, first-open seeding,
   resume-on-launch.
5. **Smoke check** — dev build boots, offline reload persists, a session
   survives a reload, install prompt available; manual pass on a phone or
   DevTools device mode.

Each step: failing test first, then the smallest code that passes, then verify
`vitest run` is green before moving on.

## What's left to the builder

Specific exercise list for the seed set; exact variant label/`howTo` text;
the card's visual layout (tall single-column, big tap targets for one-handed /
between-sets use; a default `seconds` unit shown on hold exercises); icon art;
whether to remember the last variant *and* last count/unit per exercise as
convenience defaults. All are refinements that do not change the data model,
modes, or actions above.
