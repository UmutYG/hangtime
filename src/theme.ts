import type { TextStyle } from 'react-native';
import type { AppMode, SupplementMech } from './engine/types';

export type { AppMode };

/** the app's visible name — one life, one roof. Renaming the app = changing this
 *  plus app.json "name" and Info.plist CFBundleDisplayName; nothing else. */
export const BRAND = 'Roof';

// Design tokens — warm cream surfaces, terracotta accent, hairline borders.
// Originally from the Hangtime Claude Design project ("Hangtime App.dc.html").
export const theme = {
  outerBg: '#ECE9E1',
  bg: '#FAF9F5',
  card: '#FFFFFF',
  cardMuted: '#F4F1EA',
  cardTint: '#F6E8E1',
  border: '#E7E3D9',
  borderStrong: '#D9D3C4',
  text: '#22201C',
  textDim: '#6F6B62',
  textFaint: '#A09B8F',
  accent: '#C8633F',
  accentDark: '#9A4626',
  onAccent: '#FFFFFF',
  dark: '#22201C',
  onDark: '#FFFFFF',
  good: '#3C7A57',
  warn: '#B08A2E',
  danger: '#B0413E',
  run: '#3E7CB8',
  push: '#7C58A8',
  supp: '#3F7D6B',
  mind: '#6E6FA8',
  radius: 16,
  radiusLg: 20,
  radiusSheet: 24,
  pad: 20,
} as const;

export const mono: TextStyle = {
  fontFamily: 'Menlo',
  fontVariant: ['tabular-nums'],
};

/** each space carries its own accent through every screen */
export function modeAccent(mode: AppMode): string {
  if (mode === 'running') return theme.run;
  if (mode === 'pushups') return theme.push;
  if (mode === 'supplements') return theme.supp;
  if (mode === 'mind') return theme.mind;
  return theme.accent;
}

/** the five absorption mechanisms keep their Protocol colors — they are the
 *  supplement module's inner language, distinct from the space accent */
export const MECH_COLOR: Record<SupplementMech, string> = {
  fat: '#C77A1E',
  gate: '#17796B',
  clear: '#3C6DBF',
  door: '#8E3F86',
  food: '#6B7A62',
};

export interface ModeIdentity {
  accent: string;
  /** ambient screen background — each space has its own air, not just its own paint */
  wash: string;
  name: string;
  /** the character of the movement, one line */
  motto: string;
  /** what the start button says — the movement's own invitation */
  verb: string;
}

const IDENTITY: Record<AppMode, ModeIdentity> = {
  pullups: {
    accent: theme.accent,
    wash: '#FAF8F3',
    name: 'Pull-ups',
    motto: 'You and gravity, eye to eye.',
    verb: 'Grab the bar',
  },
  pushups: {
    accent: theme.push,
    wash: '#F8F6FA',
    name: 'Push-ups',
    motto: 'Press the ground away.',
    verb: 'Hit the floor',
  },
  running: {
    accent: theme.run,
    wash: '#F4F7FA',
    name: 'Running',
    motto: 'Forward, one stride at a time.',
    verb: 'Start run',
  },
  supplements: {
    accent: theme.supp,
    wash: '#F4F8F5',
    name: 'Supplements',
    motto: 'What you take, placed where it works.',
    verb: 'Log the day',
  },
  mind: {
    accent: theme.mind,
    wash: '#FAF9F5',
    name: 'Mind',
    motto: 'A mirror for the signs you would forget.',
    verb: 'Notice',
  },
};

export function modeIdentity(mode: AppMode): ModeIdentity {
  return IDENTITY[mode];
}

export const type = {
  hero: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, color: theme.text } as TextStyle,
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.2, color: theme.text } as TextStyle,
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.accent,
    textTransform: 'uppercase',
  } as TextStyle,
  kickerDim: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: theme.textFaint,
    textTransform: 'uppercase',
  } as TextStyle,
  body: { fontSize: 13.5, lineHeight: 20, color: theme.textDim } as TextStyle,
  giant: { fontSize: 72, fontWeight: '600', letterSpacing: -2, color: theme.text } as TextStyle,
};
