import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import Svg, { Line, Circle } from "react-native-svg";
import { generateConstellation } from "../lib/constellation";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A vision's own sector of the alternatives space, lit up: a handful of
// points unique to its id, breathing at their own pace. `width`/`height` are
// only the virtual field the pattern is plotted in — the SVG itself stretches
// (via viewBox) to fill whatever real box it's dropped into, full-screen
// mirror card or a small in-context popup alike.
export function Constellation({
  seed,
  color,
  width,
  height,
  count = 7,
}: {
  seed: string;
  color: string;
  width: number;
  height: number;
  count?: number;
}) {
  const { points, edges } = useMemo(
    () => generateConstellation(seed, width, height, count),
    [seed, width, height, count]
  );
  const opacities = useRef(points.map((p) => new Animated.Value(0.15))).current;

  useEffect(() => {
    const loops = points.map((p, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacities[i], {
            toValue: 0.9,
            duration: p.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
            delay: p.delay,
          }),
          Animated.timing(opacities[i], {
            toValue: 0.15,
            duration: p.duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFillObject}
    >
      {edges.map(([a, b], i) => (
        <Line
          key={i}
          x1={points[a].x}
          y1={points[a].y}
          x2={points[b].x}
          y2={points[b].y}
          stroke={color}
          strokeWidth={0.75}
          opacity={0.22}
        />
      ))}
      {points.map((p, i) => (
        <AnimatedCircle key={i} cx={p.x} cy={p.y} r={p.r} fill={color} opacity={opacities[i]} />
      ))}
    </Svg>
  );
}
