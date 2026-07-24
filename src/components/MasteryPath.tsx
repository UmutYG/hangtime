import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LoggedSession } from '../engine/types';
import { pushMasteryPath } from '../engine/pushups';
import { theme, mono, type } from '../theme';

// The movement library — a celebration layer, never a gate. Tiers dim until
// earlier shapes add up, but every rep you've ever done shows regardless.
export function MasteryPath({ sessions }: { sessions: LoggedSession[] }) {
  const path = useMemo(() => pushMasteryPath(sessions), [sessions]);
  const maxReps = Math.max(1, ...path.flatMap((t) => t.items.map((i) => i.reps)));

  return (
    <View style={styles.card}>
      <Text style={[type.kickerDim, { color: theme.push }]}>MOVEMENT LIBRARY</Text>
      {path.map((tier) => (
        <View key={tier.title} style={[styles.tier, !tier.open && styles.tierClosed]}>
          <View style={styles.tierHeader}>
            <Text style={styles.tierTitle}>{tier.title}</Text>
            {!tier.open ? <Text style={styles.tierHint}>opens as the earlier shapes add up</Text> : null}
          </View>
          {tier.items.map(({ variation, reps }) => (
            <View key={variation.key} style={styles.row}>
              <Text style={styles.name}>{variation.name}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, (reps / maxReps) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.reps, mono]}>{reps}</Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.footer}>
        Every clean rep in a shape counts toward owning it — the count is the trail, the movement is
        the point.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 12,
  },
  tier: { gap: 4 },
  tierClosed: { opacity: 0.45 },
  tierHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  tierTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
  tierHint: { fontSize: 11, color: theme.textFaint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  name: { fontSize: 13, color: theme.textDim, width: 110 },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.cardMuted,
    overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3, backgroundColor: theme.push, opacity: 0.75 },
  reps: { fontSize: 12, color: theme.textDim, width: 44, textAlign: 'right' },
  footer: { fontSize: 12, color: theme.textFaint, lineHeight: 17.5 },
});
