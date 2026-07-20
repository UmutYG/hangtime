import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ReadinessResult } from '../engine/load';
import { theme, mono } from '../theme';

const LEVEL_LABEL: Record<ReadinessResult['level'], string> = {
  fresh: 'Fresh',
  ready: 'Ready',
  moderate: 'Some fatigue',
  fatigued: 'Fatigued',
};

const LEVEL_COLOR: Record<ReadinessResult['level'], string> = {
  fresh: theme.good,
  ready: theme.good,
  moderate: theme.warn,
  fatigued: theme.danger,
};

/** Cross-training awareness, surfaced where you decide what to do today. */
export function ReadinessCard({ readiness, accent }: { readiness: ReadinessResult; accent: string }) {
  const color = LEVEL_COLOR[readiness.level];
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>READINESS</Text>
        <View style={styles.right}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.level, { color }]}>{LEVEL_LABEL[readiness.level]}</Text>
          <Text style={[styles.score, mono]}>{readiness.score}</Text>
        </View>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(4, readiness.score)}%`, backgroundColor: color }]} />
      </View>
      {readiness.reasons.slice(0, 2).map((r, i) => (
        <Text key={i} style={styles.reason}>
          {r}
        </Text>
      ))}
      {readiness.suggestion ? (
        <Text style={[styles.suggestion, { color: accent }]}>
          {readiness.suggestion === 'rough'
            ? 'Suggested: trim today’s session — tap “Good” to override.'
            : 'Suggested: take it as it comes — tap “Good” to train full.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    padding: 16,
    gap: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: theme.textFaint },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  level: { fontSize: 12.5, fontWeight: '700' },
  score: { fontSize: 13, color: theme.textDim },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: theme.cardMuted, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  reason: { fontSize: 12.5, lineHeight: 18.5, color: theme.textDim },
  suggestion: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
