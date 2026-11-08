import Dexie, { type Table } from 'dexie';
import type { Exercise, LogEntry, Session } from '../engine/types';
import { SEED_EXERCISES } from './seeds';

/**
 * Dexie schema (v1). The design document writes the index list with `;`, but
 * Dexie's `stores()` parser splits index names on `,` (see `parseIndexSyntax`),
 * so the equivalent — and valid — Dexie syntax uses commas. The logical schema
 * is unchanged:
 *   exercises:  &++id, name, createdAt
 *   logs:       &++id, exerciseId, sessionId, performedAt
 *   sessions:   &++id, startedAt, status
 *
 * Every id is a UUID string generated via `crypto.randomUUID()`, so `add`/`put`
 * is always called with an explicit key; the auto-increment flag (`++`) is
 * inert but kept to match the design's schema string.
 */
class CardsDB extends Dexie {
  exercises!: Table<Exercise, string>;
  logs!: Table<LogEntry, string>;
  sessions!: Table<Session, string>;

  constructor() {
    super('calisthenics-cards');
    this.version(1).stores({
      exercises: '&++id, name, createdAt',
      logs: '&++id, exerciseId, sessionId, performedAt',
      sessions: '&++id, startedAt, status',
    });
  }
}

/** Singleton Dexie instance (a typed subclass of `Dexie`). */
export const db: CardsDB = new CardsDB();

/**
 * Insert a new exercise. The id is generated and `createdAt` is pinned to the
 * injected `now`; returns the full stored `Exercise`.
 */
export function addExercise(
  input: Omit<Exercise, 'id' | 'createdAt'>,
  now: number,
): Promise<Exercise> {
  const exercise: Exercise = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
  };
  return db.exercises.add(exercise).then(() => exercise);
}

/** All exercise rows. */
export function listExercises(): Promise<Exercise[]> {
  return db.exercises.toArray();
}

/** Picker view — currently the same as {@link listExercises}. */
export function exercisesForPicker(): Promise<Exercise[]> {
  return db.exercises.toArray();
}

/**
 * Insert a new log entry. The id is generated and `performedAt` is pinned to the
 * injected `now`; returns the full stored `LogEntry`.
 */
export function addLog(
  input: Omit<LogEntry, 'id' | 'performedAt'>,
  now: number,
): Promise<LogEntry> {
  const log: LogEntry = { ...input, id: crypto.randomUUID(), performedAt: now };
  return db.logs.add(log).then(() => log);
}

/** All log rows for a session (empty array when there are none). */
export function logsForSession(sessionId: string): Promise<LogEntry[]> {
  return db.logs.where('sessionId').equals(sessionId).toArray();
}

/** The active session (`status==='active'`) with the largest `startedAt`, or `undefined`. */
export async function getActiveSession(): Promise<Session | undefined> {
  const active = await db.sessions.where('status').equals('active').toArray();
  if (active.length === 0) return undefined;
  let newest = active[0];
  for (const s of active) {
    if (s.startedAt > newest.startedAt) newest = s;
  }
  return newest;
}

/** Upsert a session by id (a Dexie `put`). */
export function saveSession(session: Session): Promise<void> {
  return db.sessions.put(session).then(() => undefined);
}

/**
 * Start a new active session, enforcing "one active session at a time": within a
 * single read/write transaction, every prior session with `status==='active'` is
 * marked `'ended'` with `endedAt === now`, then the new (active) session is
 * `put`. `now` is a parameter so tests can pin `endedAt` (no `Date.now()` here).
 */
export function startSession(session: Session, now: number): Promise<void> {
  return db.transaction('rw', db.sessions, async () => {
    const active = await db.sessions.where('status').equals('active').toArray();
    for (const prior of active) {
      await db.sessions.put({ ...prior, status: 'ended', endedAt: now });
    }
    await db.sessions.put(session);
  });
}

/**
 * End the session with `sessionId`: set `status='ended'` and `endedAt === now`.
 * Never deletes the session's log rows. No-op when the session is not found.
 */
export function endSession(sessionId: string, now: number): Promise<void> {
  return db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) return;
    await db.sessions.put({ ...session, status: 'ended', endedAt: now });
  });
}

/**
 * Seed the exercise set on first open. If the `exercises` table is empty,
 * bulk-add `SEED_EXERCISES` (each with a generated `id` and `createdAt === now`);
 * otherwise a no-op. Idempotent across repeated calls.
 */
export function seedIfEmpty(now: number): Promise<void> {
  return db.transaction('rw', db.exercises, async () => {
    const count = await db.exercises.count();
    if (count > 0) return;
    const rows: Exercise[] = SEED_EXERCISES.map((exercise) => ({
      ...exercise,
      id: crypto.randomUUID(),
      createdAt: now,
    }));
    await db.exercises.bulkAdd(rows);
  });
}
