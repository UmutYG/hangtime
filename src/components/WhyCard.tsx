import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

// Static inline teaser — tap "Why?" on the session card for the full sheet.
export function WhyCard({ why }: { why: string }) {
  if (!why) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Why this workout</Text>
      <Text style={styles.why}>{why}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.cardTint,
    borderRadius: theme.radius,
    padding: 16,
    gap: 4,
  },
  label: { color: theme.accentDark, fontSize: 12, fontWeight: '700' },
  why: { color: theme.textDim, fontSize: 12.5, lineHeight: 19 },
});
