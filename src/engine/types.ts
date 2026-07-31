// Pure engine types — no React Native imports anywhere in src/engine/.

export type ISODate = string;

/** every space under the roof — theme.ts re-exports this so UI keeps importing it from there */
export type AppMode = 'pullups' | 'pushups' | 'running' | 'supplements' | 'mind';

export type DayKind =
  | 'calibration'
  | 'heavy'
  | 'volume'
  | 'max'
  | 'ladder'
  | 'deloadHeavy'
  | 'deloadVolume'
  | 'testBw'
  | 'testWeighted'
  | 'custom' // manually logged workout — feeds stats, never advances the cycle
  // push-up engine days
  | 'pushPyramid'
  | 'pushVolume'
  | 'pushMax'
  | 'pushLadder'
  | 'pushDeload'
  | 'pushTest'
  | 'pushCustom';

export type Readiness = 'good' | 'ok' | 'rough';
export type Effort = 'easy' | 'right' | 'grind';

/** How the shared upper-body joints feel today — pull and push both load
 *  elbows and shoulders, which is why one answer serves both spaces. */
export type JointFeel = 'fine' | 'tender' | 'sore';

export interface JointReport {
  date: ISODate;
  feel: JointFeel;
}

export interface Equipment {
  /** 'fixed' = a vest/plate of one set weight (progress via reps→sets→density);
   *  'adjustable' = belt with plates (progress via load). */
  mode: 'fixed' | 'adjustable';
  fixedLoadKg: number; // used in fixed mode
  smallestPlateKg: number; // used in adjustable mode
}

export interface Profile {
  bodyweightKg: number;
  startingMax: number;
  equipment: Equipment;
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
  variation?: { key: string; name: string; flavor?: string };
  note?: string;
}

export type ReasonCode =
  | 'CALIBRATION'
  | 'FIRST_VEST_SESSION'
  | 'LOAD_UP'
  | 'LOAD_UP_MICRO'
  | 'HOLD_FILL_REPS'
  | 'VEST_FILL_REPS'
  | 'ADD_SET'
  | 'DENSITY_UP'
  | 'SUGGEST_MORE_LOAD'
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
  | 'POST_DELOAD_RESUME'
  | 'VARIATION_BLOCKS'
  | 'VOLUME_ADAPTED'
  | 'VOLUME_RESTORED';

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
  /** push-up variation key; absent on legacy logs and standard sets → counts as 'standard' */
  variationKey?: string;
  /** actual rest taken AFTER this set, seconds — measured from rest-timer start to
   *  dismissal (skip) or expiry incl. +30s extensions; absent on legacy logs, warmups, last sets */
  restSecTaken?: number;
  /** planned rest after this set, copied from the plan so history can show taken-vs-plan */
  restSecPlanned?: number;
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
  /** fixed-load progression ladder: reps fill → extra set → shorter rests → "add load" advice */
  setCount: number;
  restSec: number;
  suggestMoreLoad: boolean;
}

export type VolumeOutcome = 'crisp' | 'moderate' | 'breakdown' | 'restored';

/** Volume-day autoregulation — rest-first, never harder than baseline.
 *  Grounded in velocity-loss research (≤20% drop = quality zone, ≥30% = failure
 *  territory) and rest-interval studies (short rests are what make reps fade). */
export interface VolumeTune {
  /** added to the baseline rep target; 0, -1 or -2 */
  repAdj: number;
  /** prescribed rest between volume sets; 60 | 75 | 90 */
  restSec: number;
  /** metrics from the last counted (non-exempt) volume session — for display & why */
  lastCompletionPct: number | null; // Σactual/Σtarget
  lastDropOff: number | null; // last set actual / first set actual
  lastRestOverage: number | null; // mean(taken/planned); null when no rest data
  /** classification of the last counted volume day; 'restored' = a crisp day
   *  just returned the tune to baseline (one-shot note) */
  lastOutcome: VolumeOutcome | null;
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
  volumeTune: VolumeTune;
}

export interface PR {
  kind: 'bwReps' | 'e1rm' | 'pushMax';
  value: number;
  date: ISODate;
}

/** push-up program position — mirrors the pull-up cycle machinery */
export interface PushState {
  bestMaxSet: number;
  lastTestReps: number;
  cycle: number;
  week: 1 | 2 | 3 | 4;
  sessionInWeek: 1 | 2 | 3;
  lastSessionDate: ISODate | null;
  volumeTune: VolumeTune;
}

/** which absorption mechanism governs a supplement — drives color, tag, and placement advice */
export type SupplementMech = 'fat' | 'gate' | 'clear' | 'door' | 'food';

/** ties a seeded item to its rich physiology panel; user-added items have none */
export type SupplementKind = 'creatine' | 'omega' | 'magPm' | 'zinc' | 'd3';

export interface SupplementItem {
  id: string;
  name: string;
  /** free-text timing line, e.g. "06:00 · fasted, water" */
  slot: string;
  mech: SupplementMech;
  /** what it's doing right after you take it */
  doing?: string;
  /** why it sits at this point of the day */
  why?: string;
  /** what to notice / the number that judges it */
  notice?: string;
  kind?: SupplementKind;
  /** archived items keep their history but leave the daily list */
  active: boolean;
  order: number;
  /** local time "HH:MM" for a daily reminder; absent = never remind */
  remindAt?: string;
}

/** taken, deliberately skipped, or not answered yet */
export type SupplementStatus = 'taken' | 'skipped';

/** one calendar day of supplement logging: itemId → local time string ("14:05") */
export interface SupplementDay {
  date: ISODate;
  taken: Record<string, string>;
  /** deliberately skipped today — different from simply not logged, and
   *  deliberately NOT counted as a dose anywhere */
  skipped?: Record<string, string>;
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
  /** soft-deleted sessions — restorable until emptied */
  trash: LoggedSession[];
  /** running module: imported from Apple Health or logged manually */
  runs: import('./runs').Run[];
  /** ids of Health-imported runs the user removed — blocks re-import */
  deletedRunIds: string[];
  /** user has connected Apple Health — auto-sync runs on launch */
  healthEnabled: boolean;
  /** which space the app is showing (last entered — the hub home is UI state, not stored) */
  appMode: AppMode;
  /** push-up module — null until the user enters their max */
  pushState: PushState | null;
  /** the max the user first entered — replay seed for history edits */
  pushStartingMax: number;
  pushSessions: LoggedSession[];
  pushTrash: LoggedSession[];
  pushLifetimeReps: number;
  /** latest wearable readiness (Oura / Whoop / …) — slot ready, provider later */
  externalReadiness?: import('./load').ExternalReadiness | null;
  /** optional daily joint check-ins, newest last; feeds pull + push readiness */
  jointLog?: JointReport[];
  /** supplement stack — editable in-app; archived items stay for history */
  supItems?: SupplementItem[];
  /** supplement log, one entry per calendar day with anything taken */
  supDays?: SupplementDay[];
  /** last local mutation, ISO datetime — drives cloud-sync conflict resolution */
  updatedAt?: string;
}

export interface ApplyOutcome {
  state: ProgramState;
  newPrs: PR[];
  newTests: TestPoint[];
  repsDone: number;
}
