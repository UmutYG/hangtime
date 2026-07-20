import type { TextStyle } from 'react-native';

// Design tokens — warm cream surfaces, terracotta accent, hairline borders.
// Sourced from the Hangtime Claude Design project ("Hangtime App.dc.html").
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
  radius: 16,
  radiusLg: 20,
  radiusSheet: 24,
  pad: 20,
} as const;

export const mono: TextStyle = {
  fontFamily: 'Menlo',
  fontVariant: ['tabular-nums'],
};

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
