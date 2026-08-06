import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReadinessResult } from '../engine/load';
import type { LoggedSession, SessionPlan } from '../engine/types';
import { mono, theme } from '../theme';

/**
 * The one moment training reasoning is worth reading: right before you do it.
 *
 * All of this used to live permanently on the home card, the area page and the
 * space screen — readiness reasons, load ratios, why today's session is shaped
 * the way it is. Sitting there all day, it was wallpaper. Here it has a job:
 * you are about to lift, and this is what the engine knows that you might not.
 *
 * Nothing blocks. The button underneath starts the session whether or not a
 * word of this was read.
 */
export function PreflightSheet({
  plan,
  readiness,
  recent,
  accent,
  verb,
  onStart,
  onCancel,
}: {
  plan: SessionPlan;
  readiness: ReadinessResult;
  /** the last few sessions of this space, newest last */
  recent: LoggedSession[];
  accent: string;
  verb: string;
  onStart: () => void;
  onCancel: () => void;
}) {
  const history = recent.slice(-3).reverse();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={[styles.kicker, { color: accent }]}>ABOUT TO START</Text>
            <Text style={styles.title}>{plan.title}</Text>

            {/* The one-sentence version only. The full reasoning is three
                paragraphs of programming theory — worth having, but not while
                standing under a bar; it stays behind the Why? button. */}
            <Text style={styles.sectionLabel}>WHY THIS ONE</Text>
            <Text style={styles.why}>{plan.why}</Text>

            <Text style={styles.sectionLabel}>WHERE YOU ARE</Text>
            <View style={styles.readinessRow}>
              <Text style={[styles.readinessScore, mono, { color: accent }]}>
                {readiness.score}
              </Text>
              <View style={{ flex: 1, gap: 3 }}>
                {readiness.reasons.slice(0, 2).map((r, i) => (
                  <Text key={i} style={styles.reason}>
                    {r}
                  </Text>
                ))}
              </View>
            </View>

            {history.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>LAST FEW</Text>
                {history.map((s) => {
                  const work = s.sets.filter((x) => !x.isWarmup);
                  const hit = work.reduce((a, x) => a + x.actualReps, 0);
                  const aim = work.reduce((a, x) => a + x.targetReps, 0);
                  const short = hit < aim;
                  return (
                    <View key={s.id} style={styles.histRow}>
                      <Text style={[styles.histDate, mono]}>{s.date.slice(5)}</Text>
                      <Text style={styles.histKind}>{s.dayKind}</Text>
                      <Text style={[styles.histReps, mono, short && { color: accent }]}>
                        {hit}/{aim}
                      </Text>
                      <Text style={styles.histSets}>
                        {work.map((x) => x.actualReps).join(' ')}
                      </Text>
                    </View>
                  );
                })}
              </>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onStart} style={[styles.startBtn, { backgroundColor: accent }]}>
              <Text style={styles.startText}>{verb}</Text>
            </Pressable>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.cancel}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,19,17,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: theme.radiusSheet,
    borderTopRightRadius: theme.radiusSheet,
    maxHeight: '86%',
  },
  body: { padding: 22, paddingBottom: 8, gap: 2 },
  kicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 26, fontWeight: '700', color: theme.text, marginTop: 2, marginBottom: 4 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.textFaint,
    marginTop: 20,
    marginBottom: 6,
  },
  why: { fontSize: 15.5, lineHeight: 22, color: theme.text, fontWeight: '600' },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  readinessScore: { fontSize: 34, fontWeight: '300' },
  reason: { fontSize: 13, lineHeight: 18.5, color: theme.textDim },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  histDate: { fontSize: 11.5, color: theme.textFaint, width: 40 },
  histKind: { fontSize: 12.5, color: theme.textDim, width: 74 },
  histReps: { fontSize: 12.5, color: theme.textDim, width: 52 },
  histSets: { fontSize: 12, color: theme.textFaint, flex: 1 },
  actions: {
    padding: 22,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  startBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  startText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  cancel: { textAlign: 'center', color: theme.textFaint, fontSize: 13, paddingVertical: 6 },
});
