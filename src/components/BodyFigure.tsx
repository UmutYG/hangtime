import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { BodySite } from '../engine/pharmacokinetics';
import { theme } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Where each site sits on the figure. Anatomical left/right is mirrored —
 * the liver is on the body's right, which is the viewer's left.
 */
export const SITE_POINT: Record<BodySite, { x: number; y: number }> = {
  brain: { x: 100, y: 33 },
  lymph: { x: 100, y: 82 },
  blood: { x: 100, y: 122 },
  liver: { x: 77, y: 154 },
  stomach: { x: 120, y: 150 },
  immune: { x: 128, y: 180 },
  intestine: { x: 100, y: 194 },
  muscle: { x: 79, y: 272 },
  joints: { x: 122, y: 320 },
  bone: { x: 100, y: 366 },
};

/** Sites drawn twice because the body has two of them. */
const MIRROR: Partial<Record<BodySite, { x: number; y: number }>> = {
  muscle: { x: 121, y: 272 },
  joints: { x: 78, y: 320 },
};

const VIEW_W = 200;
const VIEW_H = 420;

/**
 * A body, with the places a dose passes through marked on it.
 *
 * Intensity per site is supplied by the caller (0 = not involved, 1 = this is
 * where the dose is right now), so this component stays a renderer: it knows
 * anatomy and nothing about pharmacology.
 */
export function BodyFigure({
  active,
  accent = theme.supp,
  size = 300,
  onPressSite,
  animate = true,
}: {
  active: Partial<Record<BodySite, number>>;
  accent?: string;
  size?: number;
  onPressSite?: (site: BodySite) => void;
  animate?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  const moving = animate && !reduceMotion;

  useEffect(() => {
    if (!moving) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [moving, pulse]);

  const h = (size * VIEW_H) / VIEW_W;
  const sites = useMemo(() => Object.keys(SITE_POINT) as BodySite[], []);

  return (
    <View style={{ width: size, height: h }}>
      <Svg width={size} height={h} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <Stop offset="100%" stopColor={accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Silhouette />

        {sites.map((site) => {
          const intensity = active[site] ?? 0;
          if (intensity <= 0.02) return null;
          const points = [SITE_POINT[site], MIRROR[site]].filter(Boolean) as {
            x: number;
            y: number;
          }[];
          return (
            <G key={site}>
              {points.map((pt, i) => (
                <G key={i}>
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={26}
                    fill="url(#glow)"
                    opacity={intensity}
                  />
                  <AnimatedCircle
                    cx={pt.x}
                    cy={pt.y}
                    r={7}
                    fill={accent}
                    opacity={
                      moving
                        ? (pulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [intensity * 0.55, intensity],
                          }) as unknown as number)
                        : intensity
                    }
                  />
                </G>
              ))}
            </G>
          );
        })}

        {/* Hit targets sit last so they take the tap regardless of glow order. */}
        {onPressSite
          ? sites.map((site) => {
              const points = [SITE_POINT[site], MIRROR[site]].filter(Boolean) as {
                x: number;
                y: number;
              }[];
              return points.map((pt, i) => (
                <Circle
                  key={`${site}-hit-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={22}
                  fill="transparent"
                  onPress={() => onPressSite(site)}
                />
              ));
            })
          : null}
      </Svg>
    </View>
  );
}

/**
 * The body itself: a calm outline, drawn once and never animated. It is the
 * page the dose is marked on, not the thing being looked at.
 */
function Silhouette() {
  const stroke = theme.borderStrong;
  const fill = theme.cardMuted;
  return (
    <G>
      {/* head */}
      <Circle cx={100} cy={36} r={25} fill={fill} stroke={stroke} strokeWidth={1.5} />
      {/* neck */}
      <Path d="M92 58 L92 72 L108 72 L108 58 Z" fill={fill} stroke={stroke} strokeWidth={1.5} />
      {/* torso */}
      <Path
        d="M100 70
           C 78 70, 62 78, 58 92
           C 55 104, 57 124, 60 142
           C 63 160, 66 186, 68 208
           C 69 219, 74 224, 84 224
           L 116 224
           C 126 224, 131 219, 132 208
           C 134 186, 137 160, 140 142
           C 143 124, 145 104, 142 92
           C 138 78, 122 70, 100 70 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      {/* arms */}
      <Path
        d="M60 90 C 48 96, 42 116, 39 140 C 36 164, 34 190, 34 210
           C 34 218, 44 218, 45 210 C 47 188, 50 162, 54 140 C 57 122, 62 106, 64 98 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path
        d="M140 90 C 152 96, 158 116, 161 140 C 164 164, 166 190, 166 210
           C 166 218, 156 218, 155 210 C 153 188, 150 162, 146 140 C 143 122, 138 106, 136 98 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      {/* legs */}
      <Path
        d="M84 224 C 78 224, 74 232, 74 248 C 74 274, 77 300, 78 322
           C 79 344, 79 374, 78 398 C 78 406, 90 406, 90 398
           C 92 374, 95 344, 96 322 C 97 300, 98 268, 98 248 L 98 224 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <Path
        d="M116 224 C 122 224, 126 232, 126 248 C 126 274, 123 300, 122 322
           C 121 344, 121 374, 122 398 C 122 406, 110 406, 110 398
           C 108 374, 105 344, 104 322 C 103 300, 102 268, 102 248 L 102 224 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      {/* a hint of the gut, so the abdomen isn't a blank panel */}
      <Ellipse
        cx={100}
        cy={192}
        rx={26}
        ry={20}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        opacity={0.5}
      />
    </G>
  );
}
