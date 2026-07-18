import type { TextStyle } from 'react-native';

// Design tokens — near-black surfaces, one electric accent, hairline borders.
export const theme = {
  bg: '#0A0A0C',
  card: '#141418',
  cardRaised: '#1C1C22',
  border: '#232329',
  text: '#F5F5F7',
  textDim: '#A1A1AA',
  textFaint: '#5E5E68',
  accent: '#D9FF3F',
  accentDim: '#A9C831',
  onAccent: '#0A0A0C',
  good: '#4ADE80',
  warn: '#FBBF24',
  danger: '#F87171',
  radius: 16,
  radiusLg: 24,
  pad: 20,
} as const;

export const mono: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  hero: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8, color: theme.text } as TextStyle,
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, color: theme.text } as TextStyle,
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: theme.textFaint,
    textTransform: 'uppercase',
  } as TextStyle,
  body: { fontSize: 14, lineHeight: 21, color: theme.textDim } as TextStyle,
  giant: { fontSize: 84, fontWeight: '200', letterSpacing: -2, color: theme.text } as TextStyle,
};
