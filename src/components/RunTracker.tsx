import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { fmtDuration, fmtPace, Run } from '../engine/runs';
import { formCueFor } from '../engine/formCues';
import { theme, mono, type } from '../theme';

// In-app GPS run tracking — no external app needed. V1 tracks while Hangtime
// is in the foreground; the screen is kept awake for the whole run.

function haversineM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type Phase = 'idle' | 'tracking' | 'paused' | 'denied';

function TrackerInner({
  onSave,
  onClose,
  cueSeed = 0,
}: {
  onSave: (run: Run) => void;
  onClose: () => void;
  cueSeed?: number;
}) {
  useKeepAwake();
  const [phase, setPhase] = useState<Phase>('idle');
  const [distanceM, setDistanceM] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [gpsReady, setGpsReady] = useState(false);
  const lastPoint = useRef<Location.LocationObject | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const startedAt = useRef<number | null>(null);
  const pausedTotal = useRef(0);
  const pausedAt = useRef<number | null>(null);

  // ticking clock
  useEffect(() => {
    if (phase !== 'tracking') return;
    const id = setInterval(() => {
      if (startedAt.current) {
        setElapsedSec(Math.round((Date.now() - startedAt.current - pausedTotal.current) / 1000));
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  const start = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setPhase('denied');
      return;
    }
    startedAt.current = Date.now();
    pausedTotal.current = 0;
    setPhase('tracking');
    watcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 2000,
      },
      (loc) => {
        setGpsReady(true);
        // ignore low-quality fixes — accuracy in meters
        if ((loc.coords.accuracy ?? 99) > 30) return;
        if (lastPoint.current && pausedAt.current === null) {
          const d = haversineM(lastPoint.current.coords, loc.coords);
          // ignore GPS jitter (<2 m) and teleports (>60 m between fixes)
          if (d >= 2 && d <= 60) setDistanceM((prev) => prev + d);
        }
        lastPoint.current = loc;
      }
    );
  };

  const pause = () => {
    pausedAt.current = Date.now();
    setPhase('paused');
  };
  const resume = () => {
    if (pausedAt.current) pausedTotal.current += Date.now() - pausedAt.current;
    pausedAt.current = null;
    lastPoint.current = null; // don't count the gap as distance
    setPhase('tracking');
  };

  const stopWatching = () => {
    watcher.current?.remove();
    watcher.current = null;
  };

  const finish = () => {
    stopWatching();
    const km = Math.round((distanceM / 1000) * 100) / 100;
    if (km >= 0.3 && elapsedSec >= 120) {
      onSave({
        id: `tracked-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        distanceKm: km,
        durationSec: elapsedSec,
        source: 'manual',
      });
    }
    onClose();
  };

  const discard = () => {
    stopWatching();
    onClose();
  };

  useEffect(() => () => stopWatching(), []);

  const km = distanceM / 1000;
  const pace = km > 0.05 ? fmtPace(elapsedSec / km) : '—';

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Pressable onPress={discard} hitSlop={10}>
          <Text style={styles.cancel}>{phase === 'idle' ? 'Close' : 'Discard'}</Text>
        </Pressable>
        <Text style={[type.kickerDim, { color: theme.run }]}>RUN TRACKER</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.centerFlex}>
        <Text style={[styles.distance, mono]}>{km.toFixed(2)}</Text>
        <Text style={styles.distanceUnit}>km</Text>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, mono]}>{fmtDuration(elapsedSec)}</Text>
            <Text style={styles.statLabel}>time</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, mono]}>{pace}</Text>
            <Text style={styles.statLabel}>pace</Text>
          </View>
        </View>
        {phase === 'idle' ? (
          <>
            <Text style={styles.hint}>
              GPS tracking runs inside Hangtime — keep the app open during your run; the screen stays
              awake automatically.
            </Text>
            <Text style={styles.formNote}>{formCueFor('run', cueSeed)}</Text>
          </>
        ) : null}
        {phase === 'tracking' && !gpsReady ? (
          <Text style={styles.hint}>Acquiring GPS…</Text>
        ) : null}
        {phase === 'denied' ? (
          <Text style={styles.hint}>
            Location access was declined — enable it in iOS Settings → Hangtime → Location to track
            runs.
          </Text>
        ) : null}
      </View>

      {phase === 'idle' || phase === 'denied' ? (
        <Pressable onPress={start} style={styles.startBtn}>
          <Text style={styles.startBtnText}>Start run</Text>
        </Pressable>
      ) : (
        <View style={styles.btnRow}>
          {phase === 'tracking' ? (
            <Pressable onPress={pause} style={styles.lightBtn}>
              <Text style={styles.lightBtnText}>Pause</Text>
            </Pressable>
          ) : (
            <Pressable onPress={resume} style={styles.lightBtn}>
              <Text style={styles.lightBtnText}>Resume</Text>
            </Pressable>
          )}
          <Pressable onPress={finish} style={[styles.startBtn, { flex: 1, marginTop: 0 }]}>
            <Text style={styles.startBtnText}>Finish & save</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function RunTracker({
  visible,
  onSave,
  onClose,
  cueSeed,
}: {
  visible: boolean;
  onSave: (run: Run) => void;
  onClose: () => void;
  cueSeed?: number;
}) {
  if (Platform.OS === 'web') {
    // web preview: render the same UI; geolocation may prompt in the browser
  }
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <TrackerInner onSave={onSave} onClose={onClose} cueSeed={cueSeed} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 24, paddingTop: 64 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancel: { fontSize: 14, color: theme.textFaint, width: 60 },
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  distance: { fontSize: 96, fontWeight: '600', letterSpacing: -3, color: theme.text },
  distanceUnit: { fontSize: 16, color: theme.textFaint, marginTop: -8 },
  statRow: { flexDirection: 'row', gap: 36, marginTop: 28 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '600', color: theme.text },
  statLabel: { fontSize: 12, color: theme.textFaint, marginTop: 2 },
  hint: {
    fontSize: 12.5,
    color: theme.textFaint,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  formNote: {
    fontSize: 12,
    color: theme.textFaint,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 24,
    marginTop: 14,
  },
  startBtn: {
    backgroundColor: theme.run,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 12,
  },
  startBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  lightBtn: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  lightBtnText: { color: theme.textDim, fontSize: 15, fontWeight: '600' },
});
