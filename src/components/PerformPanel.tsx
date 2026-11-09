import { useState } from 'react';
import type { Unit, Variant } from '../engine/types';

export interface PerformPanelProps {
  variants: Variant[];
  defaultUnit?: Unit;
  onConfirm: (variantLevel: 1 | 2 | 3 | 4, count: number, unit: Unit) => void;
  onCancel: () => void;
}

/** The two log units a set can be recorded in. */
const UNITS: Unit[] = ['reps', 'seconds'];

/**
 * Thin presentation panel for logging one set. Renders one button per variant
 * present in `variants` (ascending level, lowest preselected), a count stepper
 * floored at 1, and a reps/seconds unit toggle (active value starts at
 * `defaultUnit ?? 'reps'`). Confirm hands the selection back up via `onConfirm`;
 * `onCancel` discards. The panel is stateless of the engine — it only knows the
 * callbacks and its own selection state.
 */
export function PerformPanel({
  variants,
  defaultUnit,
  onConfirm,
  onCancel,
}: PerformPanelProps) {
  const ordered = [...variants].sort((a, b) => a.level - b.level);
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4>(ordered[0].level);
  const [count, setCount] = useState(1);
  const [unit, setUnit] = useState<Unit>(defaultUnit ?? 'reps');

  const step = (delta: number) => setCount((c) => Math.max(1, c + delta));

  return (
    <div data-testid="perform-panel">
      <div>
        {ordered.map((v) => (
          <button
            key={v.level}
            type="button"
            data-testid="variant-button"
            aria-pressed={v.level === selectedLevel}
            onClick={() => setSelectedLevel(v.level)}
          >
            L{v.level}: {v.label}
          </button>
        ))}
      </div>

      <div>
        <button type="button" data-testid="count-decrement" onClick={() => step(-1)}>
          −
        </button>
        <span data-testid="count-value">{count}</span>
        <button type="button" data-testid="count-increment" onClick={() => step(1)}>
          +
        </button>
      </div>

      <div>
        {UNITS.map((u) => (
          <button
            key={u}
            type="button"
            data-testid={`unit-${u}`}
            aria-pressed={u === unit}
            onClick={() => setUnit(u)}
          >
            {u}
          </button>
        ))}
      </div>

      <button type="button" data-testid="confirm" onClick={() => onConfirm(selectedLevel, count, unit)}>
        Confirm
      </button>
      <button type="button" data-testid="cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
