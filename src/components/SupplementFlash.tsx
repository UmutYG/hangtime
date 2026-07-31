import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/**
 * The moment after logging a dose: what is happening in the body, in plain
 * language, for a few seconds.
 *
 * This is what the mechanism tags used to be for, and it does the job better —
 * "fat raft" sitting on a row every day is jargon you stop seeing, whereas this
 * only appears when you've just swallowed something, and it says what that means.
 */
export function SupplementFlash({
  name,
  doing,
  accent,
  onDone,
}: {
  name: string;
  doing: string;
  accent: string;
  onDone: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const absorb = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  useEffect(() => {
    const dismiss = () => {
      if (done.current) return;
      done.current = true;
      Animated.timing(enter, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onDone());
    };

    Animated.timing(enter, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // a bar that fills once, left to right — absorption, not a spinner
    Animated.timing(absorb, {
      toValue: 1,
      duration: 2800,
      delay: 200,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();

    // long enough to actually read two lines about your own body
    const t = setTimeout(dismiss, 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          ],
        },
      ]}
    >
      <Pressable onPress={finish} style={styles.card}>
        <Text style={[styles.name, { color: accent }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: accent,
                width: absorb.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.doing}>{doing}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 100,
  },
  card: {
    backgroundColor: theme.dark,
    borderRadius: theme.radiusLg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 9,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  name: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  track: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  fill: { height: 2, borderRadius: 1 },
  doing: { color: theme.onDark, opacity: 0.88, fontSize: 13.5, lineHeight: 19.5 },
});
