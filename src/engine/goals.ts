import { Goal, Profile, ProgramState, TestPoint } from './types';
import * as C from './constants';
import { addedLoadForReps, e1rmSystem } from './epley';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function etaMonth(from: string, monthsAhead: number): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + Math.max(0, Math.round(monthsAhead)));
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Observed monthly rate from test history, blended 50/50 with the research prior, clamped. */
function blendedRate(tests: TestPoint[], quality: 'bwReps' | 'weighted', prior: number): number {
  const pts = tests.filter((t) => t.quality === quality).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return prior;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const months =
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / (30.44 * 86_400_000);
  if (months < 0.5) return prior;
  const observed = (last.value - first.value) / months;
  const blended = 0.5 * observed + 0.5 * prior;
  return Math.min(prior * 1.5, Math.max(prior * 0.5, blended));
}

export function computeGoals(
  profile: Profile,
  state: ProgramState,
  tests: TestPoint[],
  today: string
): Goal[] {
  const goals: Goal[] = [];
  const bw = profile.bodyweightKg;

  // Bodyweight reps goal
  const currentReps = state.bwLastTestReps;
  const nextRepMilestone = C.BW_REP_MILESTONES.find((m) => m > currentReps);
  if (nextRepMilestone) {
    const rate = blendedRate(tests, 'bwReps', C.RATE_BW_REPS_PER_MONTH);
    goals.push({
      quality: 'bwReps',
      label: `${nextRepMilestone} strict pull-ups`,
      targetValue: nextRepMilestone,
      currentValue: currentReps,
      etaMonth: etaMonth(today, (nextRepMilestone - currentReps) / rate),
      ratePerMonth: Math.round(rate * 10) / 10,
    });
  }

  // Weighted goal — compare e1RM to the e1RM each milestone implies
  if (state.e1rmKg !== null) {
    const current5rm = addedLoadForReps(state.e1rmKg, bw, 5);
    const next = C.WEIGHTED_MILESTONES.find(
      (m) => e1rmSystem(bw, bw * m.pct, m.reps) > state.e1rmKg! + 0.1
    );
    if (next) {
      const targetLoad = Math.round(bw * next.pct * 2) / 2;
      const target5rmEquivalent = addedLoadForReps(e1rmSystem(bw, targetLoad, next.reps), bw, 5);
      const rate = blendedRate(
        tests.map((t) =>
          t.quality === 'weighted' ? { ...t, value: addedLoadForReps(t.value, bw, 5) } : t
        ),
        'weighted',
        C.RATE_WEIGHTED_KG_PER_MONTH
      );
      goals.push({
        quality: 'weighted',
        label: `+${targetLoad} kg × ${next.reps} (${next.tag})`,
        targetValue: targetLoad,
        currentValue: Math.round(current5rm * 2) / 2,
        etaMonth: etaMonth(today, Math.max(0.5, (target5rmEquivalent - current5rm) / rate)),
        ratePerMonth: Math.round(rate * 10) / 10,
      });
    }
  }

  return goals;
}
