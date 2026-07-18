import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Line, Text as SvgText } from 'react-native-svg';
import { theme } from '../theme';

export interface Point {
  date: string;
  value: number;
}

export function TrendChart({
  points,
  height = 160,
  width = 340,
  unit,
}: {
  points: Point[];
  height?: number;
  width?: number;
  unit: string;
}) {
  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data yet — it appears after your first sessions.</Text>
      </View>
    );
  }
  const pad = { l: 34, r: 12, t: 14, b: 20 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const lo = min - range * 0.15;
  const hi = max + range * 0.15;
  const times = points.map((p) => new Date(p.date).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const span = t1 - t0 || 1;

  const x = (t: number) => pad.l + ((t - t0) / span) * w;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * h;

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(new Date(p.date).getTime()).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');

  const gridLines = [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.75];

  return (
    <Svg width={width} height={height}>
      {gridLines.map((g, i) => (
        <Line
          key={i}
          x1={pad.l}
          x2={width - pad.r}
          y1={y(g)}
          y2={y(g)}
          stroke={theme.border}
          strokeWidth={1}
        />
      ))}
      <SvgText x={2} y={y(max) + 4} fill={theme.textDim} fontSize={10}>
        {Math.round(max)}
      </SvgText>
      <SvgText x={2} y={y(min) + 4} fill={theme.textDim} fontSize={10}>
        {Math.round(min)}
      </SvgText>
      <Path d={d} stroke={theme.accent} strokeWidth={2.5} fill="none" />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={x(new Date(p.date).getTime())}
          cy={y(p.value)}
          r={3.5}
          fill={i === points.length - 1 ? theme.accent : theme.bg}
          stroke={theme.accent}
          strokeWidth={2}
        />
      ))}
      <SvgText x={width - pad.r} y={height - 4} fill={theme.textFaint} fontSize={10} textAnchor="end">
        {unit}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyText: { color: theme.textFaint, fontSize: 13, textAlign: 'center' },
});
