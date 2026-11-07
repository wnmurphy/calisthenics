import type { Deck, Mode, Session } from './types';

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
