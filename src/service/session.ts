import {
  startSession as engineStartSession,
  endSession as engineEndSession,
  perform,
  skip,
  defer,
} from '../engine/deck';
import {
  addExercise as daoAddExercise,
  addLog,
  logsForSession,
  getActiveSession,
  saveSession,
  startSession as daoStartSession,
  endSession as daoEndSession,
  exercisesForPicker as daoExercisesForPicker,
  seedIfEmpty,
} from '../storage/db';
import type { Deck, Exercise, Mode, Unit } from '../engine/types';

/**
 * The service layer is the single async bridge the UI talks to: it composes the
 * pure engine (`../engine/deck`) with the DAO (`../storage/db`). It is the ONLY
 * place in the app that calls `Date.now()` — the injected timestamp is threaded
 * into both the engine and the DAO so a single clock value stamps an in-memory
 * and its persisted form identically.
 *
 * Import-name note: the engine and the DAO both export `startSession`/`endSession`
 * (and the DAO also exports `addExercise`/`exercisesForPicker`, which clash with
 * the service's own same-named functions). The engine's are imported under
 * `engine*`/`dao*` aliases so the collisions never surface.
 */

/** The next-card actions the UI can dispatch. */
export type PerformAction = {
  kind: 'perform';
  exerciseId: string;
  variantLevel: 1 | 2 | 3 | 4;
  count: number;
  unit: Unit;
};
export type SkipAction = { kind: 'skip'; exerciseId: string };
export type DeferAction = { kind: 'defer'; exerciseId: string };
export type Action = PerformAction | SkipAction | DeferAction;

/**
 * Reconstruct the in-progress deck from the store, or `undefined` when there is
 * no active session (fresh store, or a session that has been ended).
 */
export async function loadCurrentSession(): Promise<Deck | undefined> {
  const s = await getActiveSession();
  if (!s) return undefined;
  const performed = await logsForSession(s.id);
  return { session: s, performed };
}

/**
 * Start a fresh active session and persist it. The DAO `startSession` runs in a
 * single read/write transaction that ends every prior active session, so calling
 * this while one is open enforces "one active session at a time" without
 * deleting the prior session's logs.
 */
export async function startNewSession(mode: Mode, exerciseIds: string[]): Promise<Deck> {
  const now = Date.now();
  const deck = engineStartSession(exerciseIds, mode, now);
  await daoStartSession(deck.session, now);
  return deck;
}

/**
 * Apply a single UI action to a deck and persist the result, returning the new
 * deck. `now` is taken once at entry so the log row and the session share a
 * timestamp. `perform` also writes the log row; `skip`/`defer` only persist the
 * updated session so the queue change survives a reload.
 */
export async function applyAction(deck: Deck, action: Action): Promise<Deck> {
  const now = Date.now();
  switch (action.kind) {
    case 'perform': {
      const next = perform(
        deck,
        action.exerciseId,
        action.variantLevel,
        action.count,
        action.unit,
        now,
      );
      // `perform` is a no-op (returns the same reference) when the card is not in
      // the queue; in that case there is no new entry to log, so just return.
      if (next === deck) return next;
      const e = next.performed[next.performed.length - 1];
      await addLog(
        {
          exerciseId: e.exerciseId,
          variantLevel: e.variantLevel,
          count: e.count,
          unit: e.unit,
          sessionId: e.sessionId,
        },
        now,
      );
      await saveSession(next.session);
      return next;
    }
    case 'skip': {
      const next = skip(deck, action.exerciseId);
      await saveSession(next.session);
      return next;
    }
    case 'defer': {
      const next = defer(deck, action.exerciseId);
      await saveSession(next.session);
      return next;
    }
  }
}

/**
 * End the given session. The engine's `endSession` derives the ended in-memory
 * deck (discarded here — the service returns void); the DAO `endSession` is what
 * actually flips the persisted row to `status: 'ended'`. Log rows are preserved.
 */
export async function endSessionNow(deck: Deck): Promise<void> {
  const now = Date.now();
  engineEndSession(deck, now);
  await daoEndSession(deck.session.id, now);
}

/**
 * Add an exercise, generating its id and stamping `createdAt` with the current
 * time. Returns the full stored `Exercise`.
 */
export function addExercise(input: Omit<Exercise, 'id' | 'createdAt'>): Promise<Exercise> {
  return daoAddExercise(input, Date.now());
}

/** Picker view of the exercises (DAO passthrough). */
export function exercisesForPicker(): Promise<Exercise[]> {
  return daoExercisesForPicker();
}

/** Seed the first-open exercise set (idempotent). */
export async function seed(): Promise<void> {
  await seedIfEmpty(Date.now());
}
