import { describe, it, expect } from 'vitest';
import { buildQueue, startSession, nextCard } from './deck';
import type { Deck } from './types';

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== a.length || sb.size !== b.length) return false;
  for (const x of a) if (!sb.has(x)) return false;
  return true;
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
