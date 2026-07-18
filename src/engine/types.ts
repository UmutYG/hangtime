// Pure engine types — no React Native imports anywhere in src/engine/.

export type ISODate = string;

export type DayKind =
  | 'calibration'
  | 'heavy'
  | 'volume'
  | 'max'
  | 'ladder'
  | 'deloadHeavy'
  | 'deloadVolume'
  | 'testBw'
  | 'testWeighted';

export type Readiness = 'good' | 'ok' | 'rough';
export type Effort = 'easy' | 'right' | 'grind';

export interface Profile {
  bodyweightKg: number;
  startingMax: number;
  smallestPlateKg: number;
  trainingDays: number[]; // weekday indices 0=Sun..6=Sat, length 3
  createdAt: ISODate;
}

export interface PlannedSet {
  targetReps: number;
  loadKg: number; // added load on the belt; 0 = bodyweight
  amrap?: boolean;
  amrapCap?: number;
  isWarmup?: boolean;
  restSecAfter: number;
  ladder?: { ladderIndex: number; rung: number };
  note?: string;
}

export type ReasonCode =
  | 'CALIBRATION'
  | 'LOAD_UP'
  | 'LOAD_UP_MICRO'
  | 'HOLD_FILL_REPS'
  | 'REPEAT_AFTER_FAIL'
  | 'BACKOFF_SET'
  | 'DELOAD_SCHEDULED'
  | 'DELOAD_TRIGGERED'
  | 'SUBMAX_DERIVED'
  | 'MAX_DAY'
  | 'LADDER_DAY'
  | 'TEST_BW'
  | 'TEST_WEIGHTED'
  | 'READINESS_TRIM'
  | 'LAYOFF_RAMP'
  | 'POST_DELOAD_RESUME';

export interface Decision {
  code: ReasonCode;
  params: Record<string, string | number>;
}

export interface SessionPlan {
  dayKind: DayKind;
  cycle: number; // 1-based
  week: 1 | 2 | 3 | 4;
  sessionInWeek: 1 | 2 | 3;
  title: string;
  sets: PlannedSet[];
  decisions: Decision[];
  why: string;
  whyDetail: string;
  progressionExempt: boolean;
}

export interface SetLog {
  targetReps: number;
  actualReps: number;
  loadKg: number;
  isWarmup?: boolean;
}

export interface LoggedSession {
  id: string;
  date: ISODate;
  dayKind: DayKind;
  cycle: number;
  week: number;
  sets: SetLog[];
  readiness?: Readiness;
  lastSetEffort?: Effort;
  progressionExempt?: boolean;
}

export interface WeightedState {
  loadKg: number;
  /** last achieved working-set reps at current load, clamped to range; drives per-set targets */
  lastReps: number[];
  failStreak: number;
  grindStreak: number;
  stallCount: number;
  sessionsAtLoad: number;
  microload: boolean;
  backoffNext: boolean;
}

export interface ProgramState {
  calibrated: boolean;
  cycle: number; // 1-based
  week: 1 | 2 | 3 | 4;
  sessionInWeek: 1 | 2 | 3;
  weighted: WeightedState;
  /** best recent single max-effort BW set — drives sub-max volume targets */
  bwBestMaxSet: number;
  bwLastTestReps: number;
  e1rmKg: number | null; // system-weight estimated 1RM
  pendingDeload: boolean;
  lastSessionDate: ISODate | null;
}

export interface PR {
  kind: 'bwReps' | 'e1rm';
  value: number;
  date: ISODate;
}

export interface TestPoint {
  quality: 'bwReps' | 'weighted';
  value: number; // reps for bwReps, e1RM kg for weighted
  date: ISODate;
}

export interface Goal {
  quality: 'bwReps' | 'weighted';
  label: string;
  targetValue: number;
  currentValue: number;
  etaMonth: string; // e.g. "Dec 2026"
  ratePerMonth: number;
}

export interface Store {
  version: 1;
  profile: Profile | null;
  state: ProgramState;
  sessions: LoggedSession[];
  prs: PR[];
  tests: TestPoint[];
  lifetimeReps: number;
}

export interface ApplyOutcome {
  state: ProgramState;
  newPrs: PR[];
  newTests: TestPoint[];
  repsDone: number;
}
