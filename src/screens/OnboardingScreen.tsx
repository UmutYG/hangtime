import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useStore } from '../hooks/useStore';
import { theme } from '../theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// display order Mon-first; map to JS weekday index (0=Sun)
const JS_DAY = [1, 2, 3, 4, 5, 6, 0];

export function OnboardingScreen() {
  const { createProfile } = useStore();
  const [bw, setBw] = useState('');
  const [max, setMax] = useState('19');
  const [mode, setMode] = useState<'fixed' | 'adjustable'>('fixed');
  const [vestKg, setVestKg] = useState('7.5');
  const [days, setDays] = useState<number[]>([0, 2, 4]); // Mon/Wed/Fri in display order

  const bwNum = parseFloat(bw);
  const maxNum = parseInt(max, 10);
  const vestNum = parseFloat(vestKg);
  const valid =
    bwNum > 30 &&
    bwNum < 250 &&
    maxNum >= 1 &&
    maxNum <= 50 &&
    days.length === 3 &&
    (mode === 'adjustable' || (vestNum > 0 && vestNum < 100));

  const toggleDay = (i: number) => {
    setDays((d) =>
      d.includes(i) ? d.filter((x) => x !== i) : d.length < 3 ? [...d, i].sort() : d
    );
  };

  const go = () => {
    if (!valid) return;
    createProfile({
      bodyweightKg: bwNum,
      startingMax: maxNum,
      equipment: { mode, fixedLoadKg: vestNum || 7.5, smallestPlateKg: 1.25 },
      trainingDays: days.map((i) => JS_DAY[i]),
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.logo}>HANGTIME</Text>
        <Text style={styles.tag}>Pull-ups. Auto-planned. Explained.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Bodyweight (kg)</Text>
          <TextInput
            value={bw}
            onChangeText={setBw}
            keyboardType="numeric"
            placeholder="80"
            placeholderTextColor={theme.textFaint}
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Current strict pull-up max</Text>
          <TextInput
            value={max}
            onChangeText={setMax}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Your weight setup</Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => setMode('fixed')}
              style={[styles.chip, mode === 'fixed' && styles.chipActive]}
            >
              <Text style={[styles.chipText, mode === 'fixed' && { color: theme.onAccent }]}>
                Fixed vest
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('adjustable')}
              style={[styles.chip, mode === 'adjustable' && styles.chipActive]}
            >
              <Text style={[styles.chipText, mode === 'adjustable' && { color: theme.onAccent }]}>
                Belt + plates
              </Text>
            </Pressable>
          </View>
          {mode === 'fixed' ? (
            <>
              <Text style={styles.label}>Vest weight (kg) — measure it, you can correct later</Text>
              <TextInput
                value={vestKg}
                onChangeText={setVestKg}
                keyboardType="numeric"
                style={styles.input}
              />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Training days (pick 3)</Text>
          <View style={styles.row}>
            {WEEKDAYS.map((d, i) => (
              <Pressable
                key={d}
                onPress={() => toggleDay(i)}
                style={[styles.chip, styles.dayChip, days.includes(i) && styles.chipActive]}
              >
                <Text style={[styles.chipText, days.includes(i) && { color: theme.onAccent }]}>
                  {d}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          {mode === 'fixed'
            ? 'Your rep targets are estimated from your max, then the all-out last set of your first vest session tunes everything automatically.'
            : "Your first session calibrates the program: you'll work up to a comfortable heavy set with the belt, and every number after that is computed for you."}
        </Text>

        <Pressable onPress={go} style={[styles.startBtn, !valid && { opacity: 0.4 }]}>
          <Text style={styles.startText}>Start</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 14, paddingTop: 70, paddingBottom: 50, maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { color: theme.accent, fontSize: 30, fontWeight: '900', letterSpacing: 4 },
  tag: { color: theme.textDim, fontSize: 14, marginTop: -8, marginBottom: 10 },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 10,
  },
  label: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: theme.cardRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 17,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.cardRaised,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dayChip: { paddingHorizontal: 11 },
  chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  note: { color: theme.textFaint, fontSize: 13, lineHeight: 19 },
  startBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  startText: { color: theme.onAccent, fontSize: 17, fontWeight: '800' },
});
