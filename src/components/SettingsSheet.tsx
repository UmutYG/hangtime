import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../hooks/useStore';
import { useWeeklyLoad } from '../hooks/useReadiness';
import { exportJson } from '../lib/storage';
import { theme, mono } from '../theme';
import { Sheet } from './Sheet';

const SYNC_LABEL: Record<string, string> = {
  unavailable: 'iCloud unavailable — works after the TestFlight build (not in Expo Go)',
  idle: 'iCloud — waiting',
  syncing: 'iCloud — syncing…',
  synced: 'iCloud — synced',
  error: 'iCloud — sync failed, will retry on next change',
};
const SYNC_DOT: Record<string, string> = {
  unavailable: theme.textFaint,
  idle: theme.textFaint,
  syncing: theme.warn,
  synced: theme.good,
  error: theme.danger,
};

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { store, updateProfile, importStore, resetAll, syncState } = useStore();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [bwText, setBwText] = useState('');
  const [vestText, setVestText] = useState('');

  const profile = store.profile!;
  const s = store.state;
  const week = useWeeklyLoad();

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
      const { Share } = await import('react-native');
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
    const go = () => {
      resetAll();
      onClose();
    };
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
    <Sheet visible={visible} onClose={onClose} title="Settings">
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: SYNC_DOT[syncState] }]} />
        <Text style={styles.syncText}>{SYNC_LABEL[syncState]}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bodyweight — {profile.bodyweightKg} kg</Text>
        <View style={styles.inlineRow}>
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
          <Text style={styles.cardTitle}>Vest weight — {profile.equipment.fixedLoadKg} kg</Text>
          <View style={styles.inlineRow}>
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
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your training spaces</Text>
        <View style={styles.modeRow}>
          <View style={[styles.modeDot, { backgroundColor: theme.accent }]} />
          <Text style={styles.modeName}>Pull-ups</Text>
          <Text style={[styles.modeMeta, mono]}>{week.pull} load · 7d</Text>
        </View>
        <View style={styles.modeRow}>
          <View style={[styles.modeDot, { backgroundColor: theme.push }]} />
          <Text style={styles.modeName}>Push-ups</Text>
          <Text style={[styles.modeMeta, mono]}>
            {store.pushState ? `${week.push} load · 7d` : 'not set up'}
          </Text>
        </View>
        <View style={styles.modeRow}>
          <View style={[styles.modeDot, { backgroundColor: theme.run }]} />
          <Text style={styles.modeName}>Running</Text>
          <Text style={[styles.modeMeta, mono]}>{week.run} load · 7d</Text>
        </View>
        <Text style={styles.cardBody}>
          Readiness in each space accounts for all three — pull and push are opposite movements, so
          they share recovery rather than muscles.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Body readiness</Text>
        <Text style={styles.cardBody}>
          {store.externalReadiness
            ? `${store.externalReadiness.source}: ${store.externalReadiness.score}/100, blended into every readiness score.`
            : 'No wearable connected. Oura and Whoop slot straight into the readiness engine when you add one — the plumbing is already built.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pull-up program</Text>
        <Text style={styles.cardBody}>
          Cycle {s.cycle} · week {s.week} · training load{' '}
          <Text style={mono}>
            +
            {profile.equipment.mode === 'fixed'
              ? profile.equipment.fixedLoadKg
              : s.weighted.loadKg}{' '}
            kg
          </Text>{' '}
          · best max set <Text style={mono}>{s.bwBestMaxSet}</Text> reps
        </Text>
      </View>

      <View style={styles.inlineRow}>
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
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  syncText: { color: theme.textDim, fontSize: 12.5, flex: 1 },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  cardBody: { color: theme.textDim, fontSize: 13, lineHeight: 19 },
  inlineRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: theme.cardMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  smallBtn: {
    backgroundColor: theme.cardMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  smallBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeName: { flex: 1, fontSize: 13.5, color: theme.text, fontWeight: '600' },
  modeMeta: { fontSize: 12, color: theme.textFaint },
  dangerBtn: { alignItems: 'center', paddingVertical: 10 },
  dangerText: { color: theme.danger, fontSize: 13 },
});
