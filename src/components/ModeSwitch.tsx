import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../hooks/useStore';
import { AppMode, modeIdentity, theme } from '../theme';
import { HubSheet } from './HubSheet';
import { ModeMark } from './ModeMark';

const MODES: AppMode[] = ['pullups', 'pushups', 'running'];

// The app-space switcher plus the hub entry — same spot on every screen.
export function ModeSwitch() {
  const { store, setAppMode } = useStore();
  const [hubOpen, setHubOpen] = useState(false);
  const mode = store.appMode;
  return (
    <View style={styles.row}>
      <View style={styles.wrap}>
        {MODES.map((m) => {
          const id = modeIdentity(m);
          const active = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => setAppMode(m)}
              style={[styles.seg, active && { backgroundColor: id.accent }]}
            >
              <ModeMark mode={m} size={14} color={active ? '#FFFFFF' : theme.textFaint} />
              <Text style={[styles.text, active && styles.textActive]}>{id.name}</Text>
            </Pressable>
          );
        })}
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
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
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
