import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { JointFeel } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { useJointFeel } from '../hooks/useReadiness';
import { theme } from '../theme';

const OPTIONS: Array<{ key: JointFeel; label: string }> = [
  { key: 'fine', label: 'Fine' },
  { key: 'tender', label: 'Tender' },
  { key: 'sore', label: 'Sore' },
];

// Optional, and it stays optional: tapping the current answer clears it.
// Pull and push both load elbows and shoulders, so one answer serves both.
export function JointCheck({ accent }: { accent: string }) {
  const { setJointFeel } = useStore();
  const current = useJointFeel();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Elbows &amp; shoulders</Text>
      <View style={styles.chips}>
        {OPTIONS.map((o) => {
          const active = current === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setJointFeel(active ? null : o.key)}
              style={[styles.chip, active && { backgroundColor: accent, borderColor: accent }]}
              hitSlop={4}
            >
              <Text style={[styles.chipText, active && { color: '#FFFFFF' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: { flex: 1, fontSize: 12.5, color: theme.textFaint },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipText: { fontSize: 11.5, fontWeight: '600', color: theme.textDim },
});
