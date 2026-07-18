import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme, mono } from '../theme';

// Timestamp-based: survives backgrounding/screen-off. Parent stores endsAt (ms epoch).
export function RestTimer({
  endsAt,
  onDone,
  onSkip,
  onExtend,
}: {
  endsAt: number;
  onDone: () => void;
  onSkip: () => void;
  onExtend: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (remaining === 0) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === 0]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>REST</Text>
      <Text style={[styles.time, mono]}>{`${m}:${s.toString().padStart(2, '0')}`}</Text>
      <View style={styles.row}>
        <Pressable onPress={onExtend} style={styles.btn}>
          <Text style={styles.btnText}>+30 s</Text>
        </Pressable>
        <Pressable onPress={onSkip} style={[styles.btn, styles.btnAccent]}>
          <Text style={[styles.btnText, { color: theme.onAccent }]}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.cardRaised,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.accent,
    padding: theme.pad,
    alignItems: 'center',
    gap: 8,
  },
  label: { color: theme.accent, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  time: { color: theme.text, fontSize: 56, fontWeight: '200' },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  btnAccent: { backgroundColor: theme.accent, borderColor: theme.accent },
  btnText: { color: theme.text, fontSize: 14, fontWeight: '600' },
});
