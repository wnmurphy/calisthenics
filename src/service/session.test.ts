import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadCurrentSession,
  startNewSession,
  applyAction,
  endSessionNow,
  addExercise,
  exercisesForPicker,
  seed,
} from './session';
import { db, logsForSession } from '../storage/db';
import type { LogEntry, Variant } from '../engine/types';

// Isolation: fake-indexeddb gives a global IndexedDB that persists across tests
// in the worker. Clearing the three tables before each test gives a clean slate
// while keeping the singleton open (deleting the DB throws DatabaseClosedError in
// this Dexie 4.4 / fake-indexeddb 6.2 combo).
const N = 1_700_000_000_000;

beforeEach(async () => {
  await Promise.all([db.exercises.clear(), db.logs.clear(), db.sessions.clear()]);
  // Pin the clock via spy (NOT fake timers — fake-indexeddb is async and fake
  // timers can stall its microtasks).
  vi.spyOn(Date, 'now').mockReturnValue(N);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const variants: Variant[] = [
  { level: 1, label: 'L1', howTo: 'h' },
  { level: 2, label: 'L2', howTo: 'h' },
  { level: 3, label: 'L3', howTo: 'h' },
  { level: 4, label: 'L4', howTo: 'h' },
];

describe('service: seed', () => {
  it('seed populates six exercises and is idempotent', async () => {
    expect(await exercisesForPicker()).toHaveLength(0);
    await seed();
    expect((await exercisesForPicker()).length).toBe(6);
    await seed();
    expect((await exercisesForPicker()).length).toBe(6);
  });
});

describe('service: loadCurrentSession', () => {
  it('is undefined on a fresh store', async () => {
    expect(await loadCurrentSession()).toBeUndefined();
  });
});

describe('service: startNewSession', () => {
  it('persists the active deck and loadCurrentSession restores it', async () => {
    const deck = await startNewSession('ordered', ['a', 'b', 'c']);
    expect(deck.session.queue).toEqual(['a', 'b', 'c']);
    expect(deck.performed).toEqual([]);

    const reloaded = await loadCurrentSession();
    expect(reloaded).toBeDefined();
    expect(reloaded!.session.queue).toEqual(['a', 'b', 'c']);
    expect(reloaded!.performed).toEqual([]);
    expect(reloaded!.session.startedAt).toBe(N);
  });

  it('starting a new session ends the prior one but preserves its logs', async () => {
    let a = await startNewSession('ordered', ['a', 'b']);
    a = await applyAction(a, { kind: 'perform', exerciseId: 'a', variantLevel: 1, count: 3, unit: 'reps' });
    a = await applyAction(a, { kind: 'perform', exerciseId: 'b', variantLevel: 2, count: 4, unit: 'reps' });
    const aSessionId = a.session.id;
    expect(a.session.queue).toHaveLength(0);
    expect(a.performed).toHaveLength(2);

    const b = await startNewSession('shuffled', ['x', 'y', 'z']);
    expect(b.session.id).not.toBe(aSessionId);

    const reloaded = await loadCurrentSession();
    expect(reloaded).toBeDefined();
    expect(reloaded!.session.id).toBe(b.session.id);
    expect(reloaded!.session.mode).toBe('shuffled');
    expect(reloaded!.performed).toHaveLength(0);

    // Ending/overwriting the prior active session must never delete its logs.
    const aLogs = await logsForSession(aSessionId);
    expect(aLogs).toHaveLength(2);
  });
});

describe('service: applyAction', () => {
  it('perform records a log, drops the card, and persists it', async () => {
    const deck = await startNewSession('ordered', ['a', 'b', 'c']);
    const after = await applyAction(deck, {
      kind: 'perform',
      exerciseId: 'a',
      variantLevel: 2,
      count: 10,
      unit: 'reps',
    });

    expect(after.performed).toHaveLength(1);
    const e = after.performed[0];
    expect(e.exerciseId).toBe('a');
    expect(e.variantLevel).toBe(2);
    expect(e.count).toBe(10);
    expect(e.unit).toBe('reps');
    expect(e.sessionId).toBe(deck.session.id);
    expect(after.session.queue).toEqual(['b', 'c']);
    expect(after.session.queue).not.toContain('a');

    const reloaded = await loadCurrentSession();
    expect(reloaded!.performed).toHaveLength(1);
    expect(reloaded!.session.queue).toEqual(['b', 'c']);
    expect(reloaded!.performed[0].exerciseId).toBe('a');
    expect(reloaded!.performed[0].count).toBe(10);
    expect(reloaded!.performed[0].unit).toBe('reps');
  });

  it('skip drops the card without logging', async () => {
    const deck = await startNewSession('ordered', ['a', 'b', 'c']);
    const after = await applyAction(deck, { kind: 'skip', exerciseId: 'b' });
    expect(after.session.queue).toEqual(['a', 'c']);
    expect(after.performed).toEqual([]);

    const reloaded = await loadCurrentSession();
    expect(reloaded!.session.queue).toEqual(['a', 'c']);
    expect(reloaded!.performed).toEqual([]);
  });

  it('defer moves the card to the end of the queue', async () => {
    const deck = await startNewSession('ordered', ['a', 'b', 'c']);
    const after = await applyAction(deck, { kind: 'defer', exerciseId: 'a' });
    expect(after.session.queue).toEqual(['b', 'c', 'a']);
    expect(after.performed).toEqual([]);

    const reloaded = await loadCurrentSession();
    expect(reloaded!.session.queue).toEqual(['b', 'c', 'a']);
  });
});

describe('service: endSessionNow', () => {
  it('ends the session but preserves its log rows', async () => {
    let deck = await startNewSession('ordered', ['a', 'b']);
    deck = await applyAction(deck, { kind: 'perform', exerciseId: 'a', variantLevel: 1, count: 5, unit: 'reps' });
    const sessionId = deck.session.id;

    await endSessionNow(deck);

    expect(await loadCurrentSession()).toBeUndefined();
    const logs = await logsForSession(sessionId);
    expect(logs).toHaveLength(1);
    expect(logs[0].count).toBe(5);
  });
});

describe('service: addExercise', () => {
  it('persists a new exercise with a generated id and createdAt pinned to now', async () => {
    const created = await addExercise({ name: 'Jumping jack', equipment: 'none', variants });
    expect(typeof created.id).toBe('string');
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.createdAt).toBe(N);
    expect(created.name).toBe('Jumping jack');
    expect(created.variants).toHaveLength(4);

    const picker = await exercisesForPicker();
    expect(picker).toHaveLength(1);
    expect(picker[0].name).toBe('Jumping jack');
  });
});

describe('service: reload mid-session (whole app)', () => {
  it('reconstructs queue + logs after two performs', async () => {
    const d0 = await startNewSession('shuffled', ['a', 'b', 'c']);
    expect(d0.session.queue).toHaveLength(3);
    const first = d0.session.queue[0];
    const second = d0.session.queue[1];
    const sessionId = d0.session.id;

    const d1 = await applyAction(d0, { kind: 'perform', exerciseId: first, variantLevel: 2, count: 10, unit: 'reps' });
    const d2 = await applyAction(d1, { kind: 'perform', exerciseId: second, variantLevel: 1, count: 8, unit: 'seconds' });

    expect(d2.session.queue).toHaveLength(1);
    expect(d2.performed).toHaveLength(2);

    const reloaded = await loadCurrentSession();
    expect(reloaded).toBeDefined();
    expect(reloaded!.session.queue).toHaveLength(1);
    expect(reloaded!.performed).toHaveLength(2);

    // Fields match what was performed — NOT id equality across the reload.
    const sig = (e: LogEntry) => `${e.exerciseId}|${e.count}|${e.unit}|${e.sessionId}`;
    const expected = d2.performed.map(sig).sort();
    const actual = reloaded!.performed.map(sig).sort();
    expect(actual).toEqual(expected);
    expect(reloaded!.performed.every((e) => e.sessionId === sessionId)).toBe(true);
  });
});
