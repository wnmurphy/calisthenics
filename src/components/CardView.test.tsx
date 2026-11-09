import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardView } from './CardView';
import type { Exercise } from '../engine/types';

const exercise: Exercise = {
  id: 'ex1',
  name: 'Push-up',
  equipment: 'none',
  variants: [
    { level: 1, label: 'Wall', howTo: 'h' },
    { level: 2, label: 'Incline', howTo: 'h' },
    { level: 3, label: 'Floor', howTo: 'h' },
    { level: 4, label: 'Decline', howTo: 'h' },
  ],
  createdAt: 0,
};

const exerciseNoEquip: Exercise = { ...exercise, id: 'ex2', equipment: undefined };

describe('CardView', () => {
  it('renders the name, equipment when provided, and one row per variant', () => {
    render(
      <CardView
        exercise={exercise}
        mode="ordered"
        onPerformed={vi.fn()}
        onSkip={vi.fn()}
        onDefer={vi.fn()}
      />,
    );
    expect(screen.getByText('Push-up')).toBeTruthy();
    expect(screen.getByTestId('equipment').textContent).toBe('none');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('omits the equipment when it is undefined', () => {
    render(
      <CardView
        exercise={exerciseNoEquip}
        mode="ordered"
        onPerformed={vi.fn()}
        onSkip={vi.fn()}
        onDefer={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('equipment')).toBeNull();
  });

  it('ordered mode shows Defer and clicking it calls onDefer', async () => {
    const user = userEvent.setup();
    const onDefer = vi.fn();
    render(
      <CardView
        exercise={exercise}
        mode="ordered"
        onPerformed={vi.fn()}
        onSkip={vi.fn()}
        onDefer={onDefer}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Defer' }));
    expect(onDefer).toHaveBeenCalled();
  });

  it('shuffled mode shows Defer and clicking it calls onDefer', async () => {
    const user = userEvent.setup();
    const onDefer = vi.fn();
    render(
      <CardView
        exercise={exercise}
        mode="shuffled"
        onPerformed={vi.fn()}
        onSkip={vi.fn()}
        onDefer={onDefer}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Defer' }));
    expect(onDefer).toHaveBeenCalled();
  });

  it('free-select mode has no Defer button in the DOM', () => {
    render(
      <CardView
        exercise={exercise}
        mode="free-select"
        onPerformed={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(screen.queryByText('Defer')).toBeNull();
  });

  it('Perform opens the panel; Confirm calls onPerformed with (id, level, count, unit)', async () => {
    const user = userEvent.setup();
    const onPerformed = vi.fn();
    render(
      <CardView
        exercise={exercise}
        mode="ordered"
        onPerformed={onPerformed}
        onSkip={vi.fn()}
        onDefer={vi.fn()}
      />,
    );
    // Panel closed initially.
    expect(screen.queryByTestId('perform-panel')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Perform' }));
    // Panel open.
    expect(screen.getByTestId('perform-panel')).toBeTruthy();
    // Default: lowest level (1), count 1, reps.
    await user.click(screen.getByTestId('confirm'));
    expect(onPerformed).toHaveBeenCalledWith('ex1', 1, 1, 'reps');
    // Panel closed again after confirming.
    expect(screen.queryByTestId('perform-panel')).toBeNull();
  });

  it('Skip calls onSkip', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <CardView
        exercise={exercise}
        mode="ordered"
        onPerformed={vi.fn()}
        onSkip={onSkip}
        onDefer={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalled();
  });
});
