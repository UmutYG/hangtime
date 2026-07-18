import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export function WhyCard({ why, detail }: { why: string; detail: string }) {
  const [open, setOpen] = useState(false);
  if (!why) return null;
  return (
    <Pressable onPress={() => setOpen(!open)} style={styles.card}>
      <Text style={styles.label}>WHY THIS WORKOUT</Text>
      <Text style={styles.why}>{why}</Text>
      {open && detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {detail ? <Text style={styles.more}>{open ? 'less' : 'more'}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    padding: theme.pad,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
  },
  label: { color: theme.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  why: { color: theme.text, fontSize: 15, lineHeight: 21 },
  detail: { color: theme.textDim, fontSize: 13, lineHeight: 19, marginTop: 4 },
  more: { color: theme.textFaint, fontSize: 12, marginTop: 2 },
});
