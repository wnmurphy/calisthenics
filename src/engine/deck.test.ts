import { describe, it, expect } from 'vitest';
import {
  buildQueue,
  startSession,
  nextCard,
  perform,
  skip,
  defer,
  isDone,
  endSession,
  summary,
} from './deck';
import type { Deck, LogEntry } from './types';

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== a.length || sb.size !== b.length) return false;
  for (const x of a) if (!sb.has(x)) return false;
  return true;
}

function mkEntry(
  exerciseId: string,
  variantLevel: 1 | 2 | 3 | 4,
  count: number,
  unit: 'reps' | 'seconds',
): LogEntry {
  return {
    id: crypto.randomUUID(),
    exerciseId,
    variantLevel,
    count,
    unit,
    performedAt: 0,
    sessionId: 's',
  };
}

describe('buildQueue', () => {
  it('ordered: deep-equals input and is a distinct copy', () => {
    const input = ['a', 'b', 'c'];
    const result = buildQueue(input, 'ordered');
    expect(result).toEqual(['a', 'b', 'c']);
    expect(result).not.toBe(input);
    // Mutating the result must not affect the input.
    result.push('d');
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('shuffled: is a permutation of the input (N=3)', () => {
    const input = ['a', 'b', 'c'];
    const snapshot = input.slice();
    const result = buildQueue(input, 'shuffled');
    expect(new Set(result).size).toBe(3);
    expect(sameSet(result, ['a', 'b', 'c'])).toBe(true);
    expect(input).toEqual(snapshot);
    expect(result).not.toBe(input);
  });

  it('shuffled: N=1 keeps the single element', () => {
    const input = ['a'];
    const result = buildQueue(input, 'shuffled');
    expect(result).toEqual(['a']);
    expect(input).toEqual(['a']);
  });

  it('shuffled: N=0 yields empty', () => {
    const input: string[] = [];
    const result = buildQueue(input, 'shuffled');
    expect(result).toEqual([]);
    expect(input).toEqual([]);
  });

  it('free-select: always yields an empty queue', () => {
    expect(buildQueue(['a', 'b', 'c'], 'free-select')).toEqual([]);
    expect(buildQueue([], 'free-select')).toEqual([]);
  });
});

describe('startSession', () => {
  it('shuffled session has the right shape and a generated id', () => {
    const deck = startSession(['a', 'b'], 'shuffled', 1000);
    expect(deck.session.status).toBe('active');
    expect(deck.session.mode).toBe('shuffled');
    expect(new Set(deck.session.queue).size).toBe(2);
    expect(sameSet(deck.session.queue, ['a', 'b'])).toBe(true);
    expect(deck.session.startedAt).toBe(1000);
    expect(deck.session.endedAt).toBeUndefined();
    expect(typeof deck.session.id).toBe('string');
    expect(deck.session.id.length).toBeGreaterThan(0);
    expect(deck.performed).toEqual([]);
    expect(deck.performed).not.toBe(deck.session.queue);
  });

  it('ordered session keeps input order', () => {
    const deck = startSession(['a', 'b', 'c'], 'ordered', 0);
    expect(deck.session.queue).toEqual(['a', 'b', 'c']);
  });
});

describe('nextCard', () => {
  it('ordered: returns the first id in the queue', () => {
    const deck: Deck = {
      session: { id: 's1', mode: 'ordered', queue: ['x', 'y'], status: 'active', startedAt: 0 },
      performed: [],
    };
    expect(nextCard(deck)).toBe('x');
  });

  it('empty queue returns null', () => {
    const deck: Deck = {
      session: { id: 's2', mode: 'ordered', queue: [], status: 'active', startedAt: 0 },
      performed: [],
    };
    expect(nextCard(deck)).toBeNull();
  });

  it('free-select returns null even when the queue is populated', () => {
    const deck: Deck = {
      session: { id: 's3', mode: 'free-select', queue: ['x', 'y'], status: 'active', startedAt: 0 },
      performed: [],
    };
    expect(nextCard(deck)).toBeNull();
  });
});

describe('perform', () => {
  it('appends a LogEntry (last), removes the card, and does not mutate the input', () => {
    const deck = startSession(['a', 'b'], 'ordered', 0);
    const origQueue = deck.session.queue;
    const origPerformed = deck.performed;

    const next = perform(deck, 'a', 2, 10, 'reps', 1000);

    expect(next).not.toBe(deck);
    expect(next.performed.length).toBe(1);
    const entry = next.performed[next.performed.length - 1];
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(entry).toEqual({
      id: entry.id,
      exerciseId: 'a',
      variantLevel: 2,
      count: 10,
      unit: 'reps',
      performedAt: 1000,
      sessionId: deck.session.id,
    });
    // 'a' removed from the queue
    expect(next.session.queue).toEqual(['b']);
    expect(next.session.queue).not.toContain('a');
    // input deck untouched (no in-place reassignment of its arrays)
    expect(deck.session.queue).toEqual(['a', 'b']);
    expect(deck.session.queue).toBe(origQueue);
    expect(deck.performed).toEqual([]);
    expect(deck.performed).toBe(origPerformed);
    // the new deck carries fresh arrays
    expect(next.session.queue).not.toBe(origQueue);
    expect(next.performed).not.toBe(origPerformed);
  });

  it('appends the new entry LAST when performed is already non-empty', () => {
    const base = startSession(['a'], 'ordered', 0);
    const deck: Deck = { session: base.session, performed: [mkEntry('z', 1, 5, 'reps')] };
    const next = perform(deck, 'a', 1, 8, 'reps', 2000);
    expect(next.performed.length).toBe(2);
    expect(next.performed[0].exerciseId).toBe('z');
    expect(next.performed[1].exerciseId).toBe('a');
    expect(next.performed[1]).toBe(next.performed[next.performed.length - 1]);
    expect(next.performed).not.toBe(deck.performed);
    expect(deck.performed).toHaveLength(1);
  });

  it('is a no-op (same deck) when exerciseId is not in the queue', () => {
    const deck = startSession(['a', 'b'], 'ordered', 0);
    const next = perform(deck, 'z', 3, 5, 'seconds', 111);
    expect(next).toBe(deck);
    expect(next.performed.length).toBe(0);
    expect(next.session.queue).toEqual(['a', 'b']);
  });
});

describe('skip', () => {
  it('removes the card from the queue and leaves performed untouched', () => {
    const deck = startSession(['a', 'b', 'c'], 'ordered', 0);
    const origQueue = deck.session.queue;
    const origPerformed = deck.performed;
    const next = skip(deck, 'a');
    expect(next.session.queue).toEqual(['b', 'c']);
    expect(next.performed).toEqual([]);
    expect(next.performed).toBe(origPerformed);
    expect(deck.session.queue).toEqual(['a', 'b', 'c']);
    expect(deck.session.queue).toBe(origQueue);
    expect(next.session.queue).not.toBe(origQueue);
  });

  it('is a no-op when exerciseId is not in the queue', () => {
    const deck = startSession(['a', 'b'], 'ordered', 0);
    const next = skip(deck, 'z');
    expect(next).toBe(deck);
    expect(next.session.queue).toEqual(['a', 'b']);
  });
});

describe('defer', () => {
  it('moves the card to the end, preserving the relative order of the others', () => {
    const deck = startSession(['a', 'b', 'c'], 'ordered', 0);
    const next = defer(deck, 'b');
    expect(next.session.queue).toEqual(['a', 'c', 'b']);
    expect(new Set(next.session.queue).size).toBe(3);
    expect(sameSet(next.session.queue, ['a', 'b', 'c'])).toBe(true);
    expect(deck.session.queue).toEqual(['a', 'b', 'c']);
    expect(next.session.queue).not.toBe(deck.session.queue);
  });

  it('is a no-op when the card is already last', () => {
    const deck = startSession(['a', 'b', 'c'], 'ordered', 0);
    const next = defer(deck, 'c');
    expect(next.session.queue).toEqual(['a', 'b', 'c']);
  });

  it('leaves a 1-card queue at length 1', () => {
    const deck = startSession(['x'], 'ordered', 0);
    const next = defer(deck, 'x');
    expect(next.session.queue).toEqual(['x']);
    expect(next.session.queue.length).toBe(1);
  });

  it('is a no-op when exerciseId is not in the queue', () => {
    const deck = startSession(['a', 'b'], 'ordered', 0);
    const next = defer(deck, 'z');
    expect(next.session.queue).toEqual(['a', 'b']);
  });
});

describe('isDone', () => {
  it('ordered with an empty queue is done', () => {
    expect(isDone(startSession([], 'ordered', 0))).toBe(true);
  });

  it('shuffled with an empty queue is done', () => {
    expect(isDone(startSession([], 'shuffled', 0))).toBe(true);
  });

  it('ordered with a non-empty queue is not done', () => {
    expect(isDone(startSession(['a'], 'ordered', 0))).toBe(false);
  });

  it('free-select is never done, even with an empty queue', () => {
    const deck: Deck = {
      session: { id: 's', mode: 'free-select', queue: [], status: 'active', startedAt: 0 },
      performed: [],
    };
    expect(isDone(deck)).toBe(false);
  });

  it('free-select is not done even when the queue is populated', () => {
    const deck: Deck = {
      session: { id: 's', mode: 'free-select', queue: ['x', 'y'], status: 'active', startedAt: 0 },
      performed: [],
    };
    expect(isDone(deck)).toBe(false);
  });
});

describe('endSession', () => {
  it('ends the session with the given timestamp without mutating the input', () => {
    const deck = startSession(['a', 'b'], 'ordered', 0);
    const origQueue = deck.session.queue;
    const origPerformed = deck.performed;
    const next = endSession(deck, 5000);
    expect(next.session.status).toBe('ended');
    expect(next.session.endedAt).toBe(5000);
    expect(next.session.queue).toEqual(['a', 'b']);
    expect(next.performed).toEqual([]);
    // input untouched
    expect(deck.session.status).toBe('active');
    expect(deck.session.endedAt).toBeUndefined();
    expect(deck.session.queue).toBe(origQueue);
    expect(deck.performed).toBe(origPerformed);
    // the new deck is a fresh object graph
    expect(next).not.toBe(deck);
    expect(next.session).not.toBe(deck.session);
  });
});

describe('summary', () => {
  it('sums reps and seconds and returns a fresh items array', () => {
    const performed = [
      mkEntry('a', 1, 10, 'reps'),
      mkEntry('b', 2, 15, 'reps'),
      mkEntry('c', 3, 60, 'seconds'),
    ];
    const deck: Deck = {
      session: { id: 's', mode: 'ordered', queue: [], status: 'active', startedAt: 0 },
      performed,
    };
    const s = summary(deck);
    expect(s).toEqual({ sets: 3, totalReps: 25, totalSeconds: 60, items: performed });
    expect(s.items.length).toBe(3);
    expect(s.items).not.toBe(performed);
    // mutating the summary's items must not affect the deck
    s.items.push(mkEntry('d', 1, 1, 'reps'));
    expect(deck.performed.length).toBe(3);
  });

  it('an empty deck yields all zeros and an empty items array', () => {
    const s = summary(startSession([], 'ordered', 0));
    expect(s).toEqual({ sets: 0, totalReps: 0, totalSeconds: 0, items: [] });
  });
});
