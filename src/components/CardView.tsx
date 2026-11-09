import { useState } from 'react';
import type { Exercise, Mode, Unit } from '../engine/types';
import { PerformPanel } from './PerformPanel';

export interface CardViewProps {
  exercise: Exercise;
  mode: Mode;
  onPerformed: (exerciseId: string, level: 1 | 2 | 3 | 4, count: number, unit: Unit) => void;
  onSkip: () => void;
  onDefer?: () => void;
}

/**
 * The card the user looks at and logs a set from. Thin presentation: it renders
 * the exercise (name, optional equipment, one row per variant) plus Perform /
 * Skip buttons and — only in `'ordered'` / `'shuffled'` modes — a Defer button.
 *
 * **Free-select Defer suppression:** in `'free-select'` mode there is no Defer
 * concept (the queue is not ordered), so the Defer button is NOT rendered at all.
 *
 * **Perform** opens a `PerformPanel` overlay (the open/close boolean is owned
 * here). On the panel's `onConfirm`, CardView closes the panel and calls
 * `onPerformed` with the exercise id and the panel's selection. `onCancel` just
 * closes the panel. `defaultUnit` is intentionally not passed in v1 — `Exercise`
 * has no `unit` field, so the panel defaults to `'reps'` and the user toggles
 * for holds.
 */
export function CardView({
  exercise,
  mode,
  onPerformed,
  onSkip,
  onDefer,
}: CardViewProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const showDefer = mode === 'ordered' || mode === 'shuffled';

  return (
    <div data-testid="card">
      <h2>{exercise.name}</h2>
      {exercise.equipment ? <p data-testid="equipment">{exercise.equipment}</p> : null}
      <ul>
        {exercise.variants.map((v) => (
          <li key={v.level}>
            L{v.level}: {v.label}
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => setPanelOpen(true)}>
        Perform
      </button>
      <button type="button" onClick={onSkip}>
        Skip
      </button>
      {showDefer ? (
        <button type="button" onClick={onDefer}>
          Defer
        </button>
      ) : null}

      {panelOpen ? (
        <PerformPanel
          variants={exercise.variants}
          onConfirm={(level, count, unit) => {
            setPanelOpen(false);
            onPerformed(exercise.id, level, count, unit);
          }}
          onCancel={() => setPanelOpen(false)}
        />
      ) : null}
    </div>
  );
}
