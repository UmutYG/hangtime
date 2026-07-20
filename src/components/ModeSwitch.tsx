import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../hooks/useStore';
import { theme } from '../theme';
import { HubSheet } from './HubSheet';

// The app-space switcher plus the hub entry — same spot on every screen.
export function ModeSwitch() {
  const { store, setAppMode } = useStore();
  const [hubOpen, setHubOpen] = useState(false);
  const mode = store.appMode;
  return (
    <View style={styles.row}>
      <View style={styles.wrap}>
        <Pressable
          onPress={() => setAppMode('pullups')}
          style={[styles.seg, mode === 'pullups' && { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.text, mode === 'pullups' && styles.textActive]}>Pull-ups</Text>
        </Pressable>
        <Pressable
          onPress={() => setAppMode('pushups')}
          style={[styles.seg, mode === 'pushups' && { backgroundColor: theme.push }]}
        >
          <Text style={[styles.text, mode === 'pushups' && styles.textActive]}>Push-ups</Text>
        </Pressable>
        <Pressable
          onPress={() => setAppMode('running')}
          style={[styles.seg, mode === 'running' && { backgroundColor: theme.run }]}
        >
          <Text style={[styles.text, mode === 'running' && styles.textActive]}>Running</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => setHubOpen(true)} style={styles.hubBtn} hitSlop={8}>
        <Text style={styles.hubIcon}>◱</Text>
      </Pressable>
      <HubSheet visible={hubOpen} onClose={() => setHubOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: {
    flexDirection: 'row',
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    padding: 3,
  },
  seg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  text: { fontSize: 12, fontWeight: '600', color: theme.textDim },
  textActive: { color: '#FFFFFF' },
  hubBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubIcon: { fontSize: 15, color: theme.textDim },
});
