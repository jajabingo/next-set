// The hardcoded workout plan and core workout (PRD sections 5 and 6).

export const ROTATION = [
  {
    id: "chest-back",
    name: "Chest & Back",
    exercises: [
      { id: "incline-db-bench", name: "Incline dumbbell bench press" },
      { id: "wide-lat-pulldown", name: "Wide-grip lat pulldowns" },
    ],
    blocks: [{ label: null, sets: 10, items: [{ ex: 0, reps: 10 }, { ex: 1, reps: 10 }] }],
  },
  {
    id: "legs",
    name: "Legs",
    exercises: [
      { id: "back-squat", name: "Back squat" },
      { id: "leg-curl", name: "Leg curls" },
    ],
    blocks: [{ label: null, sets: 10, items: [{ ex: 0, reps: 10 }, { ex: 1, reps: 10 }] }],
  },
  {
    id: "arms",
    name: "Arms",
    exercises: [
      { id: "incline-db-curl", name: "Incline seated dumbbell curls" },
      { id: "ez-skull-crusher", name: "Incline seated EZ-bar skull crushers" },
      { id: "rope-hammer-curl", name: "Rope hammer curls" },
      { id: "rope-pulldown", name: "Rope pull-downs" },
    ],
    blocks: [
      { label: "Dumbbell curls", sets: 4, items: [{ ex: 0, reps: 12 }] },
      { label: "Skull crushers", sets: 4, items: [{ ex: 1, reps: 12 }] },
      { label: "Hammer curls + pull-downs", sets: 4, items: [{ ex: 2, reps: 25 }, { ex: 3, reps: 25 }] },
    ],
  },
  {
    id: "back-shoulders",
    name: "Lower Back & Shoulders",
    exercises: [
      { id: "deadlift", name: "Deadlifts" },
      { id: "db-shoulder-press", name: "Shoulder dumbbell press" },
    ],
    blocks: [{ label: null, sets: 10, items: [{ ex: 0, reps: 10 }, { ex: 1, reps: 10 }] }],
  },
];

export function workoutById(id) {
  return ROTATION.find((w) => w.id === id);
}

export function followingWorkout(id) {
  const i = ROTATION.findIndex((w) => w.id === id);
  return ROTATION[(i + 1) % ROTATION.length];
}

// Every set of a workout, in order, with the block it belongs to.
export function setsOf(workout) {
  const sets = [];
  workout.blocks.forEach((block, b) => {
    for (let n = 1; n <= block.sets; n++) {
      sets.push({
        block: b,
        blockLabel: block.label,
        setInBlock: n,
        blockSets: block.sets,
        items: block.items.map((it) => ({ name: workout.exercises[it.ex].name, reps: it.reps })),
      });
    }
  });
  return sets;
}

export const CORE = {
  prep: 10,
  work: 20,
  rest: 10,
  rounds: 8,
  exercises: ["Bicycles", "Flutter kicks", "V crunches", "Mountain climbers", "Twist crunches", "Alternating V-ups", "Planks"],
};
export const CORE_INTERVALS = CORE.exercises.length * CORE.rounds; // 56
// Prep + every work interval + every rest except the one after the final interval = 28:00.
export const CORE_TOTAL = CORE.prep + CORE_INTERVALS * (CORE.work + CORE.rest) - CORE.rest;

// Where the core workout is at t seconds (not counting pauses).
// k = index of the current work interval (0-55); left = seconds remaining in this phase.
export function corePositionAt(t) {
  if (t < CORE.prep) {
    return { phase: "prep", k: -1, exIndex: 0, round: 1, left: CORE.prep - t, completedWork: 0 };
  }
  const cycle = CORE.work + CORE.rest;
  const r = t - CORE.prep;
  const k = Math.floor(r / cycle);
  const inCycle = r - k * cycle;
  if (t >= CORE_TOTAL) {
    return { phase: "done", k: CORE_INTERVALS - 1, exIndex: CORE.exercises.length - 1, round: CORE.rounds, left: 0, completedWork: CORE_INTERVALS };
  }
  const exIndex = Math.floor(k / CORE.rounds);
  const round = (k % CORE.rounds) + 1;
  if (inCycle < CORE.work) {
    return { phase: "work", k, exIndex, round, left: CORE.work - inCycle, completedWork: k };
  }
  return { phase: "rest", k, exIndex, round, left: cycle - inCycle, completedWork: k + 1 };
}
