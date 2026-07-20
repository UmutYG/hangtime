import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../hooks/useStore';
import { theme } from '../theme';

// The app-space switcher — one compact segmented pill, same spot on every screen.
export function ModeSwitch() {
  const { store, setAppMode } = useStore();
  const mode = store.appMode;
  return (
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    padding: 3,
  },
  seg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  text: { fontSize: 12, fontWeight: '600', color: theme.textDim },
  textActive: { color: '#FFFFFF' },
});
