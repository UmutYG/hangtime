import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme';

export function ProgressRing({
  size = 52,
  stroke = 5,
  fraction,
  color = theme.accent,
  trackColor = theme.cardTint,
}: {
  size?: number;
  stroke?: number;
  fraction: number; // 0..1
  color?: string;
  trackColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)));
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <Circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}
