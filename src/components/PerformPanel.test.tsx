import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerformPanel } from './PerformPanel';
import type { Variant } from '../engine/types';

const variants: Variant[] = [
  { level: 1, label: 'Wall', howTo: 'h' },
  { level: 2, label: 'Incline', howTo: 'h' },
  { level: 3, label: 'Floor', howTo: 'h' },
  { level: 4, label: 'Decline', howTo: 'h' },
];

describe('PerformPanel', () => {
  it('renders one button per variant present, in ascending order, lowest preselected', () => {
    render(<PerformPanel variants={variants} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const buttons = screen.getAllByTestId('variant-button');
    expect(buttons).toHaveLength(4);
    expect(buttons.map((b) => b.textContent)).toEqual([
      'L1: Wall',
      'L2: Incline',
      'L3: Floor',
      'L4: Decline',
    ]);
    // The lowest present level is preselected.
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('renders no button for missing levels', () => {
    const sparse: Variant[] = [
      { level: 1, label: 'A', howTo: 'h' },
      { level: 3, label: 'C', howTo: 'h' },
    ];
    render(<PerformPanel variants={sparse} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    // Two variants with levels [1, 3] yield exactly two buttons — no blank L2.
    expect(screen.getAllByTestId('variant-button')).toHaveLength(2);
  });

  it('count starts at 1 and steps up to 2', async () => {
    const user = userEvent.setup();
    render(<PerformPanel variants={variants} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('count-value').textContent).toBe('1');
    await user.click(screen.getByTestId('count-increment'));
    expect(screen.getByTestId('count-value').textContent).toBe('2');
  });

  it('defaultUnit "seconds" makes the seconds toggle active', () => {
    render(
      <PerformPanel variants={variants} defaultUnit="seconds" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByTestId('unit-seconds').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('unit-reps').getAttribute('aria-pressed')).toBe('false');
  });

  it('omitted defaultUnit makes reps active', () => {
    render(<PerformPanel variants={variants} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('unit-reps').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('unit-seconds').getAttribute('aria-pressed')).toBe('false');
  });

  it('Confirm fires onConfirm with the selected level, count, and unit', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PerformPanel variants={variants} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'L2: Incline' }));
    await user.click(screen.getByTestId('count-increment'));
    await user.click(screen.getByTestId('confirm'));
    expect(onConfirm).toHaveBeenCalledWith(2, 2, 'reps');
  });

  it('Cancel fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<PerformPanel variants={variants} onConfirm={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByTestId('cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('toggling to seconds before Confirm changes the unit argument (hold logs in seconds)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PerformPanel variants={variants} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(screen.getByTestId('unit-seconds'));
    await user.click(screen.getByTestId('confirm'));
    expect(onConfirm).toHaveBeenCalledWith(1, 1, 'seconds');
  });
});
