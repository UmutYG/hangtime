import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { AppMode } from '../theme';

// Each space gets a mark drawn from the physics of its thing:
// pull-ups hang from a bar, push-ups press the ground away, running strides
// forward, supplements are a capsule split at its seam.
export function ModeMark({
  mode,
  size = 16,
  color,
}: {
  /** 'body' is the life-area mark (pulse line), not a space */
  mode: AppMode | 'body';
  size?: number;
  color: string;
}) {
  const sw = 2.1;
  if (mode === 'body') {
    // the pulse — one body, read as a single line
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M2 12.5 H7 L10 6.5 L14 18 L16.8 12.5 H22"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (mode === 'mind') {
    // Slide's four-point star — a sign noticed before it fades
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3 C12.8 8.2 15.8 11.2 21 12 C15.8 12.8 12.8 15.8 12 21 C11.2 15.8 8.2 12.8 3 12 C8.2 11.2 11.2 8.2 12 3 Z"
          fill={color}
        />
      </Svg>
    );
  }
  if (mode === 'pullups') {
    // the bar, two hanging arms, shoulders below — gravity pulls down, you pull up
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Line x1={3} y1={5} x2={21} y2={5} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={8} y1={5} x2={8} y2={13} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={16} y1={5} x2={16} y2={13} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M8 13 Q12 17.5 16 13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  }
  if (mode === 'pushups') {
    // ground line, plank body, head up — the floor is the apparatus
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Line x1={2} y1={20} x2={22} y2={20} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={4} y1={16} x2={17} y2={10} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={11.5} y1={12.5} x2={11.5} y2={20} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Circle cx={19.6} cy={8} r={2} fill={color} />
      </Svg>
    );
  }
  if (mode === 'running') {
    // running: strides rising forward, the last one pointing on
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Line x1={2.5} y1={19} x2={8} y2={17.4} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Line x1={10} y1={14.5} x2={15.5} y2={12.9} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M17.5 10 L21.5 8 L19.8 12" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  // supplements: a capsule, seam showing — one half filled, taken and working
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={8.75} width={17} height={6.5} rx={3.25} stroke={color} strokeWidth={sw} />
      <Path d="M12 8.75 H17.25 A3.25 3.25 0 0 1 17.25 15.25 H12 Z" fill={color} />
    </Svg>
  );
}
