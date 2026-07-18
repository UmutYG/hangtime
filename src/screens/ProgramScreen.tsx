import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useStore } from '../hooks/useStore';
import { exportJson } from '../lib/storage';
import { theme, mono } from '../theme';

const WEEK_LABELS = ['Build', 'Build', 'Build', 'Deload + Test'];

// Program education lives contextually in each session's "why" card —
// this screen only answers "where am I" and holds settings.

const SYNC_LABEL: Record<string, string> = {
  unavailable: 'iCloud unavailable — works after the TestFlight build (not in Expo Go)',
  idle: 'iCloud — waiting',
  syncing: 'iCloud — syncing…',
  synced: 'iCloud — synced',
  error: 'iCloud — sync failed, will retry on next change',
};

export function ProgramScreen() {
  const { store, updateProfile, importStore, resetAll, syncState, lastSyncedAt, syncNow } =
    useStore();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [bwText, setBwText] = useState('');
  const [vestText, setVestText] = useState('');

  const profile = store.profile!;
  const s = store.state;

  const doExport = async () => {
    const json = exportJson(store);
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hangtime-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: json });
    }
  };

  const doImport = () => {
    if (importStore(importText.trim())) {
      setImportOpen(false);
      setImportText('');
    } else if (Platform.OS === 'web') {
      window.alert('Could not read that backup JSON.');
    } else {
      Alert.alert('Import failed', 'Could not read that backup JSON.');
    }
  };

  const doReset = () => {
    const go = () => resetAll();
    if (Platform.OS === 'web') {
      if (window.confirm('Erase all training data? This cannot be undone.')) go();
    } else {
      Alert.alert('Reset everything?', 'All training data will be erased.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase', style: 'destructive', onPress: go },
      ]);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Program</Text>

      <View style={styles.card}>
        <Text style={styles.cardKicker}>WHERE YOU ARE</Text>
        <View style={styles.weekStrip}>
          {[1, 2, 3, 4].map((w) => (
            <View
              key={w}
              style={[styles.weekCell, s.week === w && styles.weekCellActive]}
            >
              <Text style={[styles.weekNum, mono, s.week === w && { color: theme.onAccent }]}>{w}</Text>
              <Text style={[styles.weekLabel, s.week === w && { color: theme.onAccent }]}>
                {WEEK_LABELS[w - 1]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.cardBody}>
          Cycle {s.cycle} · week {s.week} · next test:{' '}
          {s.cycle % 2 === 1 ? 'bodyweight max reps' : 'weighted 5RM'} at the end of this cycle.
          {s.pendingDeload ? ' Early deload is queued — the program noticed accumulated fatigue.' : ''}
        </Text>
        <Text style={styles.cardBody}>
          {profile.equipment.mode === 'fixed' ? (
            <>
              Vest: <Text style={mono}>+{profile.equipment.fixedLoadKg} kg</Text> ·{' '}
              <Text style={mono}>{s.weighted.setCount}</Text> working sets ·{' '}
              <Text style={mono}>{Math.round(s.weighted.restSec / 60)} min</Text> rests
            </>
          ) : (
            <>
              Current training load: <Text style={mono}>+{s.weighted.loadKg} kg</Text>
            </>
          )}
          {' '}· best max set: <Text style={mono}>{s.bwBestMaxSet}</Text> reps
          {s.e1rmKg ? (
            <>
              {' '}· est. system 1RM: <Text style={mono}>{Math.round(s.e1rmKg)} kg</Text>
            </>
          ) : null}
        </Text>
      </View>

      <Text style={styles.h2}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bodyweight: {profile.bodyweightKg} kg</Text>
        <View style={styles.rowGap}>
          <TextInput
            value={bwText}
            onChangeText={setBwText}
            placeholder="new kg"
            placeholderTextColor={theme.textFaint}
            keyboardType="numeric"
            style={styles.input}
          />
          <Pressable
            onPress={() => {
              const v = parseFloat(bwText);
              if (v > 30 && v < 250) {
                updateProfile({ bodyweightKg: v });
                setBwText('');
              }
            }}
            style={styles.smallBtn}
          >
            <Text style={styles.smallBtnText}>Save</Text>
          </Pressable>
        </View>
      </View>
      {profile.equipment.mode === 'fixed' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vest weight: {profile.equipment.fixedLoadKg} kg</Text>
          <View style={styles.rowGap}>
            <TextInput
              value={vestText}
              onChangeText={setVestText}
              placeholder="measured kg"
              placeholderTextColor={theme.textFaint}
              keyboardType="numeric"
              style={styles.input}
            />
            <Pressable
              onPress={() => {
                const v = parseFloat(vestText);
                if (v > 0 && v < 100) {
                  updateProfile({ equipment: { ...profile.equipment, fixedLoadKg: v } });
                  setVestText('');
                }
              }}
              style={styles.smallBtn}
            >
              <Text style={styles.smallBtnText}>Save</Text>
            </Pressable>
          </View>
          <Text style={styles.cardBody}>
            Measured your vest, or added weight to it? Update this — all targets re-derive
            automatically.
          </Text>
        </View>
      ) : null}

      <Pressable onPress={() => void syncNow()} style={styles.card}>
        <View style={styles.rowGap}>
          <View
            style={[
              styles.syncDot,
              syncState === 'synced' && { backgroundColor: theme.good },
              syncState === 'error' && { backgroundColor: theme.danger },
              syncState === 'syncing' && { backgroundColor: theme.warn },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{SYNC_LABEL[syncState]}</Text>
            <Text style={styles.cardBody}>
              {lastSyncedAt
                ? `Last synced ${lastSyncedAt.slice(11, 16)} · tap to sync now`
                : 'Backs up automatically after every session · tap to sync now'}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.rowGap}>
        <Pressable onPress={doExport} style={[styles.smallBtn, { flex: 1 }]}>
          <Text style={styles.smallBtnText}>Export backup</Text>
        </Pressable>
        <Pressable onPress={() => setImportOpen(!importOpen)} style={[styles.smallBtn, { flex: 1 }]}>
          <Text style={styles.smallBtnText}>Import backup</Text>
        </Pressable>
      </View>
      {importOpen ? (
        <View style={styles.card}>
          <TextInput
            value={importText}
            onChangeText={setImportText}
            placeholder="Paste backup JSON here"
            placeholderTextColor={theme.textFaint}
            multiline
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          />
          <Pressable onPress={doImport} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>Import</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={doReset} style={styles.dangerBtn}>
        <Text style={styles.dangerText}>Reset all data</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.pad, gap: 12, paddingBottom: 40 },
  h1: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 10 },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 8,
  },
  cardKicker: { color: theme.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  cardTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  cardBody: { color: theme.textDim, fontSize: 13, lineHeight: 20 },
  weekStrip: { flexDirection: 'row', gap: 6 },
  weekCell: {
    flex: 1,
    backgroundColor: theme.cardRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekCellActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  weekNum: { color: theme.text, fontSize: 16, fontWeight: '800' },
  weekLabel: { color: theme.textDim, fontSize: 9, marginTop: 2 },
  rowGap: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: theme.cardRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  smallBtn: {
    backgroundColor: theme.cardRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  smallBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  dangerBtn: { alignItems: 'center', paddingVertical: 12 },
  dangerText: { color: theme.danger, fontSize: 13 },
  syncDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.textFaint,
    marginTop: 4,
  },
});
