import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { AppMode } from '../theme';

// Each space gets a mark drawn from the physics of its movement:
// pull-ups hang from a bar, push-ups press the ground away, running strides forward.
export function ModeMark({
  mode,
  size = 16,
  color,
}: {
  mode: AppMode;
  size?: number;
  color: string;
}) {
  const sw = 2.1;
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
  // running: strides rising forward, the last one pointing on
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={2.5} y1={19} x2={8} y2={17.4} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1={10} y1={14.5} x2={15.5} y2={12.9} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M17.5 10 L21.5 8 L19.8 12" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
