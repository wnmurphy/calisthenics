import type { Deck, LogEntry, Mode, Session, Unit } from './types';

/**
 * Build the working queue for a session.
 * - ordered: a copy of `exerciseIds` in the same order (never the same
 *   reference; mutating the result must not affect the input).
 * - shuffled: a permutation of `exerciseIds` (same multiset), in-place
 *   Fisher-Yates on a copy so the input is untouched.
 * - free-select: `[]` — cards come from the picker, not a queue.
 */
export function buildQueue(exerciseIds: string[], mode: Mode): string[] {
  if (mode === 'free-select') return [];
  const queue = exerciseIds.slice();
  if (mode === 'shuffled') {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
  }
  return queue;
}

/**
 * Start a fresh, active session. `now` is the injected timestamp (pure: no
 * `Date`/`window`). The session id is generated via `crypto.randomUUID()`.
 */
export function startSession(exerciseIds: string[], mode: Mode, now: number): Deck {
  const session: Session = {
    id: crypto.randomUUID(),
    mode,
    queue: buildQueue(exerciseIds, mode),
    status: 'active',
    startedAt: now,
    endedAt: undefined,
  };
  return { session, performed: [] };
}

/**
 * The next card to surface. For ordered/shuffled decks it is the first id in
 * the queue, or `null` when the queue is empty. Free-select has no queue to
 * pull from (cards come from the picker), so it always returns `null`.
 */
export function nextCard(deck: Deck): string | null {
  const { session } = deck;
  if (session.mode === 'free-select') return null;
  const q = session.queue;
  return q.length > 0 ? q[0] : null;
}

/**
 * Record that `exerciseId` was performed: append a new `LogEntry` to a fresh
 * `performed` array and drop the card from the queue, returning a NEW `Deck`
 * (the input is never mutated). If `exerciseId` is not in the queue, return the
 * input `deck` unchanged — no new log, no queue change.
 */
export function perform(
  deck: Deck,
  exerciseId: string,
  variantLevel: 1 | 2 | 3 | 4,
  count: number,
  unit: Unit,
  now: number,
): Deck {
  const queue = deck.session.queue;
  const idx = queue.indexOf(exerciseId);
  if (idx === -1) return deck;
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    exerciseId,
    variantLevel,
    count,
    unit,
    performedAt: now,
    sessionId: deck.session.id,
  };
  const newQueue = queue.slice();
  newQueue.splice(idx, 1);
  return {
    session: { ...deck.session, queue: newQueue },
    performed: [...deck.performed, entry],
  };
}

/**
 * Skip `exerciseId`: return a new `Deck` with the card removed from the queue;
 * `performed` is left untouched. No-op (returns the input unchanged) when the
 * card is not in the queue.
 */
export function skip(deck: Deck, exerciseId: string): Deck {
  const queue = deck.session.queue;
  const idx = queue.indexOf(exerciseId);
  if (idx === -1) return deck;
  const newQueue = queue.slice();
  newQueue.splice(idx, 1);
  return { session: { ...deck.session, queue: newQueue }, performed: deck.performed };
}

/**
 * Defer `exerciseId`: return a new `Deck` with the card moved to the END of the
 * queue, preserving the relative order of the others. A no-op (returns the input
 * unchanged) when the card is already last, when the queue is a single card, or
 * when the card is not in the queue.
 */
export function defer(deck: Deck, exerciseId: string): Deck {
  const queue = deck.session.queue;
  const idx = queue.indexOf(exerciseId);
  if (idx === -1) return deck;
  if (idx === queue.length - 1) return deck;
  const newQueue = queue.slice();
  newQueue.splice(idx, 1);
  newQueue.push(exerciseId);
  return { session: { ...deck.session, queue: newQueue }, performed: deck.performed };
}

/**
 * Whether the session is done. Ordered/shuffled sessions are done when the
 * queue is empty; free-select sessions are never "done" via the queue (cards
 * come from the picker), so they are always false.
 */
export function isDone(deck: Deck): boolean {
  if (deck.session.mode === 'free-select') return false;
  return deck.session.queue.length === 0;
}

/**
 * End the session: return a new `Deck` whose `session.status` is `'ended'` and
 * `session.endedAt` is `now`. The queue and `performed` are carried over
 * unchanged and the input deck is never mutated.
 */
export function endSession(deck: Deck, now: number): Deck {
  return {
    session: { ...deck.session, status: 'ended', endedAt: now },
    performed: deck.performed,
  };
}

/**
 * Summarize a session. `sets` is the number of performed entries; `totalReps`
 * sums the `count` of every `'reps'` entry and `totalSeconds` sums the `count`
 * of every `'seconds'` entry; `items` is a FRESH copy of `deck.performed`
 * (never the caller's array).
 */
export function summary(
  deck: Deck,
): { sets: number; totalReps: number; totalSeconds: number; items: LogEntry[] } {
  let totalReps = 0;
  let totalSeconds = 0;
  for (const entry of deck.performed) {
    if (entry.unit === 'reps') totalReps += entry.count;
    else if (entry.unit === 'seconds') totalSeconds += entry.count;
  }
  return {
    sets: deck.performed.length,
    totalReps,
    totalSeconds,
    items: deck.performed.slice(),
  };
}
