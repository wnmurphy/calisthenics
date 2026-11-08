import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  addExercise,
  listExercises,
  exercisesForPicker,
  addLog,
  logsForSession,
  getActiveSession,
  saveSession,
  startSession,
  endSession,
  seedIfEmpty,
} from './db';
import { SEED_EXERCISES } from './seeds';
import type { Exercise, LogEntry, Session, Variant } from '../engine/types';

// Isolation: fake-indexeddb gives a global IndexedDB that persists across tests
// in the worker. Clearing the three tables before each test gives a clean slate
// and keeps the singleton open. (The brief's suggested `await db.delete()` is
// not usable here: in this Dexie 4.4 / fake-indexeddb 6.2 combo the closed
// singleton does not auto-reopen, so the next operation throws
// `DatabaseClosedError`. Clearing tables is an equivalent isolation guarantee.)
beforeEach(async () => {
  await Promise.all([db.exercises.clear(), db.logs.clear(), db.sessions.clear()]);
});

const pushupVariants: Variant[] = [
  { level: 1, label: 'Wall push-up', howTo: 'h' },
  { level: 2, label: 'Incline push-up', howTo: 'h' },
  { level: 3, label: 'Floor push-up', howTo: 'h' },
  { level: 4, label: 'Decline push-up', howTo: 'h' },
];

function activeSession(
  id: string,
  startedAt: number,
  queue: string[] = ['a'],
  mode: Session['mode'] = 'ordered',
): Session {
  return { id, mode, queue, status: 'active', startedAt, endedAt: undefined };
}

describe('exercises DAO', () => {
  it('addExercise assigns a non-empty id and pins createdAt to now', async () => {
    const created = await addExercise(
      { name: 'Push-up', variants: pushupVariants },
      1000,
    );
    expect(typeof created.id).toBe('string');
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.createdAt).toBe(1000);
    expect(created.name).toBe('Push-up');
    expect(created.variants).toHaveLength(4);
  });

  it('listExercises and exercisesForPicker return the same added row', async () => {
    await addExercise({ name: 'Push-up', variants: pushupVariants }, 1000);
    const listed = await listExercises();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('Push-up');
    const picker = await exercisesForPicker();
    expect(picker).toHaveLength(1);
    expect(picker).toEqual(listed);
  });
});

describe('logs DAO', () => {
  it('addLog assigns an id and pins performedAt; logsForSession filters by sessionId', async () => {
    const entry = await addLog(
      { exerciseId: 'a', variantLevel: 1, count: 10, unit: 'reps', sessionId: 's1' },
      1000,
    );
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(entry.performedAt).toBe(1000);
    expect(entry.exerciseId).toBe('a');
    expect(entry.variantLevel).toBe(1);
    expect(entry.count).toBe(10);
    expect(entry.unit).toBe('reps');
    expect(entry.sessionId).toBe('s1');

    const forSession = await logsForSession('s1');
    expect(forSession).toHaveLength(1);
    expect(forSession[0].id).toBe(entry.id);

    const none = await logsForSession('other');
    expect(none).toEqual([]);
  });
});

describe('session lifecycle', () => {
  it('getActiveSession is undefined on a fresh db', async () => {
    expect(await getActiveSession()).toBeUndefined();
  });

  it('startSession persists the active session and getActiveSession returns it', async () => {
    await startSession(activeSession('A', 100), 100);
    const active = await getActiveSession();
    expect(active).toBeDefined();
    expect(active!.id).toBe('A');
    expect(active!.status).toBe('active');
  });

  it('a second startSession ends the prior active session (one active at a time)', async () => {
    await startSession(activeSession('A', 100), 100);
    await startSession(activeSession('B', 200), 200);

    const active = await getActiveSession();
    expect(active).toBeDefined();
    expect(active!.id).toBe('B');
    expect(active!.status).toBe('active');

    const endedA = await db.sessions.get('A');
    expect(endedA).toBeDefined();
    expect(endedA!.status).toBe('ended');
    expect(endedA!.endedAt).toBe(200);
  });

  it('endSession ends the session by id and preserves its log rows', async () => {
    await startSession(activeSession('A', 100), 100);
    await addLog(
      { exerciseId: 'a', variantLevel: 2, count: 5, unit: 'reps', sessionId: 'A' },
      150,
    );
    await endSession('A', 300);

    const ended = await db.sessions.get('A');
    expect(ended).toBeDefined();
    expect(ended!.status).toBe('ended');
    expect(ended!.endedAt).toBe(300);

    // Ending a session must never delete its log rows.
    const logs = await logsForSession('A');
    expect(logs).toHaveLength(1);
    expect(logs[0].count).toBe(5);
    expect(logs[0].sessionId).toBe('A');
  });
});

describe('seeds', () => {
  it('seedIfEmpty populates exactly six exercises', async () => {
    expect(SEED_EXERCISES).toHaveLength(6);
    await seedIfEmpty(1000);
    expect((await listExercises()).length).toBe(6);
  });

  it('seedIfEmpty is idempotent (a second call is a no-op)', async () => {
    await seedIfEmpty(1000);
    await seedIfEmpty(1000);
    expect((await listExercises()).length).toBe(6);
  });

  it('seeded exercises carry createdAt pinned to now', async () => {
    await seedIfEmpty(1234);
    const all = await listExercises();
    expect(all).toHaveLength(6);
    for (const ex of all) {
      expect(ex.createdAt).toBe(1234);
      expect(typeof ex.id).toBe('string');
      expect(ex.id.length).toBeGreaterThan(0);
      expect(ex.variants).toHaveLength(4);
    }
  });
});

describe('reload mid-session (review focus)', () => {
  it('persists the in-progress queue and log rows across a simulated reload', async () => {
    // Start a shuffled session from ['a','b','c']; after progressing two cards
    // the live queue is ['c'].
    const started: Session = {
      id: 'R1',
      mode: 'shuffled',
      queue: ['a', 'b', 'c'],
      status: 'active',
      startedAt: 100,
      endedAt: undefined,
    };
    const e1: LogEntry = {
      id: 'L1',
      exerciseId: 'a',
      variantLevel: 2,
      count: 10,
      unit: 'reps',
      performedAt: 110,
      sessionId: 'R1',
    };
    const e2: LogEntry = {
      id: 'L2',
      exerciseId: 'b',
      variantLevel: 1,
      count: 8,
      unit: 'seconds',
      performedAt: 120,
      sessionId: 'R1',
    };

    await addLog(
      { exerciseId: e1.exerciseId, variantLevel: e1.variantLevel, count: e1.count, unit: e1.unit, sessionId: e1.sessionId },
      110,
    );
    await addLog(
      { exerciseId: e2.exerciseId, variantLevel: e2.variantLevel, count: e2.count, unit: e2.unit, sessionId: e2.sessionId },
      120,
    );
    await saveSession({ ...started, queue: ['c'] });

    // Re-open purely through the DAO, as if the app had reloaded.
    const active = await getActiveSession();
    expect(active).toBeDefined();
    expect(active!.id).toBe('R1');
    expect(active!.mode).toBe('shuffled');
    expect(active!.queue).toEqual(['c']);

    const logs = await logsForSession('R1');
    expect(logs).toHaveLength(2);
    const byId = new Map<string, LogEntry>(logs.map((l) => [l.id, l]));
    const addedIds = new Set(logs.map((l) => l.id));
    // The reloaded rows must carry identical id/count/unit/sessionId to what
    // was logged (ids generated by the DAO, but the other fields match).
    for (const id of addedIds) {
      const reloaded = byId.get(id)!;
      expect(typeof reloaded.id).toBe('string');
      expect(reloaded.sessionId).toBe('R1');
    }
    // And the two reloaded rows have the two distinct counts/units we logged.
    const counts = new Set(logs.map((l) => l.count));
    expect(counts.has(10)).toBe(true);
    expect(counts.has(8)).toBe(true);
    const units = new Set(logs.map((l) => l.unit));
    expect(units.has('reps')).toBe(true);
    expect(units.has('seconds')).toBe(true);
  });
});
