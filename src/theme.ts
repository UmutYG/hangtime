export const theme = {
  bg: '#0C0C0E',
  card: '#151519',
  cardRaised: '#1C1C22',
  border: '#26262E',
  text: '#F2F2F5',
  textDim: '#9A9AA5',
  textFaint: '#5C5C66',
  accent: '#E8FF5A',
  accentDim: '#B8CC3E',
  onAccent: '#0C0C0E',
  good: '#5AE88A',
  warn: '#FFB03A',
  danger: '#FF5A6E',
  radius: 14,
  pad: 16,
} as const;

import type { TextStyle } from 'react-native';

export const mono: TextStyle = { fontVariant: ['tabular-nums'] };
