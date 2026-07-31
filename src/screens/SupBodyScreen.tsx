import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { bodyCards, stripData } from '../engine/supplements';
import { useStore } from '../hooks/useStore';
import { MECH_COLOR, mono, theme, type } from '../theme';
import { RoofBar } from '../components/RoofBar';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Where you are in a process — not a score. Computed from logged days. */
export function SupBodyScreen() {
  const { store } = useStore();
  const items = store.supItems ?? [];
  const days = store.supDays ?? [];
  const today = todayIso();

  const cards = bodyCards(items, days, today);
  const activeCount = items.filter((i) => i.active).length;
  const strip = stripData(days, activeCount, today);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RoofBar />
      <Text style={type.hero}>Body</Text>
      <Text style={styles.note}>
        What's happening inside — computed from your logged days, not the calendar. Where you are in
        a process, not a score.
      </Text>

      {cards.map((c) => {
        const item = items.find((i) => i.id === c.itemId);
        const color = item ? MECH_COLOR[item.mech] : theme.supp;
        return (
          <View key={c.itemId} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{c.title}</Text>
              <Text style={[styles.cardStage, mono]}>{c.stage.toUpperCase()}</Text>
            </View>
            {c.pct !== null ? (
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, Math.max(2, c.pct))}%`, backgroundColor: color },
                  ]}
                />
              </View>
            ) : null}
            <Text style={styles.cardBody}>{c.body}</Text>
          </View>
        );
      })}

      <View style={styles.card}>
        <Text style={[type.kickerDim, { color: theme.supp }]}>LAST 14 DAYS</Text>
        <View style={styles.strip}>
          {strip.bars.map((b) => (
            <View key={b.date} style={styles.stripDay}>
              <View style={styles.stripTrack}>
                {b.taken > 0 ? (
                  <View
                    style={[
                      styles.stripFill,
                      {
                        height: `${Math.max(b.pct, 7)}%`,
                        backgroundColor: b.isToday ? theme.text : theme.textFaint,
                      },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={[styles.stripLabel, mono]}>{b.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.legend}>{strip.legend}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 12, paddingBottom: 120 },
  note: { color: theme.textDim, fontSize: 13, lineHeight: 19.5, marginTop: -6 },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 16,
    gap: 9,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  cardName: { fontSize: 14.5, fontWeight: '700', color: theme.text, flexShrink: 1 },
  cardStage: { fontSize: 9.5, color: theme.textFaint, letterSpacing: 0.5 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: theme.cardMuted, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  cardBody: { fontSize: 13, lineHeight: 19.5, color: theme.textDim },
  strip: { flexDirection: 'row', gap: 5, height: 70, alignItems: 'flex-end', marginTop: 4 },
  stripDay: { flex: 1, height: '100%', justifyContent: 'flex-end', gap: 5 },
  stripTrack: {
    flex: 1,
    backgroundColor: theme.cardMuted,
    borderRadius: 3,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  stripFill: { width: '100%', borderRadius: 3 },
  stripLabel: { fontSize: 8, color: theme.textFaint, textAlign: 'center', height: 10 },
  legend: { fontSize: 11.5, color: theme.textFaint, marginTop: 2 },
});
