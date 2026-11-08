import type { Exercise } from '../engine/types';

/**
 * The first-open seed set: six fundamental movements, each with four
 * progressive variants (level 1 → 4). `id`/`createdAt` are assigned at seed
 * time by `seedIfEmpty`, so the type omits them.
 *
 * Plank's variant labels reference *seconds* so a user can toggle the log unit
 * to `seconds`; v1 has no `unit` field on `Exercise`.
 *
 * `equipment` is 'pull-up bar' for Pull-up and 'none' for the bodyweight moves.
 */
export const SEED_EXERCISES: Omit<Exercise, 'id' | 'createdAt'>[] = [
  {
    name: 'Push-up',
    equipment: 'none',
    variants: [
      {
        level: 1,
        label: 'Wall push-up',
        howTo:
          'Stand an arm-length from a wall and press it away with straight arms to warm up the pushing chain.',
      },
      {
        level: 2,
        label: 'Incline push-up',
        howTo:
          'Place your hands on an elevated surface and lower your chest toward it while holding a straight line from head to heels.',
      },
      {
        level: 3,
        label: 'Floor push-up',
        howTo:
          'Press up off the floor with a rigid body from shoulders to heels, keeping the elbows tucked close to the torso.',
      },
      {
        level: 4,
        label: 'Decline push-up',
        howTo:
          'Elevate your feet on a raised surface and press the floor away while holding a single rigid plank line.',
      },
    ],
  },
  {
    name: 'Squat',
    equipment: 'none',
    variants: [
      {
        level: 1,
        label: 'Chair squat',
        howTo:
          'Sit back onto a chair under control, pause, then stand back up by driving through your legs.',
      },
      {
        level: 2,
        label: 'Bodyweight squat',
        howTo:
          'Lower your hips until your thighs are at least parallel to the floor, keeping the chest up, then drive back up.',
      },
      {
        level: 3,
        label: 'Deep squat',
        howTo:
          'Sink below parallel while keeping the chest up and the weight balanced through the mid-foot.',
      },
      {
        level: 4,
        label: 'Pistol squat',
        howTo:
          'Balance on one leg and lower straight down, then stand back up using only that leg.',
      },
    ],
  },
  {
    name: 'Pull-up',
    equipment: 'pull-up bar',
    variants: [
      {
        level: 1,
        label: 'Chin-up',
        howTo:
          'Hang from a bar with an underhand grip and pull your chin above the bar under control.',
      },
      {
        level: 2,
        label: 'Pull-up',
        howTo:
          'Hang from a bar with an overhand grip and pull your chin over the bar, then lower with control.',
      },
      {
        level: 3,
        label: 'Wide-grip pull-up',
        howTo:
          'Grip the bar wider than shoulder width and pull your chest up toward the bar while the shoulders stay down.',
      },
      {
        level: 4,
        label: 'One-arm row progress',
        howTo:
          'Hang from a high bar and row your body up toward one hand, building the base for a one-arm pull.',
      },
    ],
  },
  {
    name: 'Plank',
    equipment: 'none',
    variants: [
      {
        level: 1,
        label: 'Knee plank 20 s',
        howTo:
          'Hold a straight line on your forearms and knees, bracing the core, for 20 seconds.',
      },
      {
        level: 2,
        label: 'Full plank 45 s',
        howTo:
          'Press onto your toes and forearms in one rigid line from head to heels and hold for 45 seconds.',
      },
      {
        level: 3,
        label: 'Side plank 30 s',
        howTo:
          'Stack on one forearm and the side of one foot and hold a straight side line for 30 seconds.',
      },
      {
        level: 4,
        label: 'Weighted plank 60 s',
        howTo:
          'Hold a full plank with a weight resting across the back and sustain the rigid line for 60 seconds.',
      },
    ],
  },
  {
    name: 'Dips',
    equipment: 'none',
    variants: [
      {
        level: 1,
        label: 'Bench dips',
        howTo:
          'Support yourself on the edge of a bench with the feet forward and lower the body by bending the elbows.',
      },
      {
        level: 2,
        label: 'Close-grip dips',
        howTo:
          'Grip the parallel bars close together and lower straight down while keeping the elbows tucked in.',
      },
      {
        level: 3,
        label: 'Wide-grip dips',
        howTo:
          'Grip the bars wider than shoulder width and lower the body while leaning slightly forward.',
      },
      {
        level: 4,
        label: 'L-sit dips',
        howTo:
          'Hold the legs out in an L-sit and press up and down without letting the legs drop.',
      },
    ],
  },
  {
    name: 'Lunge',
    equipment: 'none',
    variants: [
      {
        level: 1,
        label: 'Standing lunge',
        howTo:
          'Step one foot forward and lower the hips until both knees reach about 90 degrees, then return.',
      },
      {
        level: 2,
        label: 'Walking lunge',
        howTo:
          'Lunge forward and continue stepping through, alternating legs as you travel forward.',
      },
      {
        level: 3,
        label: 'Reverse lunge',
        howTo:
          'Step one foot back and lower the hips, keeping the torso upright, then push back to the start.',
      },
      {
        level: 4,
        label: 'Split squat',
        howTo:
          'Hold a wide, stable stance and lower the hips straight down, then press back up without stepping.',
      },
    ],
  },
];
