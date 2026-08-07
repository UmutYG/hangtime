import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Image, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, font, radius, spacing } from "../lib/theme";
import { prettyDate, dateKey, currentWeekStart } from "../lib/dates";
import { useSettings } from "../lib/SettingsContext";
import { getEvents, deleteEvents, PositiveEvent } from "../lib/events";
import { LogEventSheet } from "../components/LogEventSheet";
import { WeeklyRecap } from "../components/WeeklyRecap";
import { DailyRecap } from "../components/DailyRecap";
import SettingsScreen from "./SettingsScreen";

const LOGO = require("../../../assets/mind-logo.png");

// The home page: a calm "today" surface. The mirror at the top, then a place to
// notice a positive sign, then a few living tiles — each one freshly made each
// day, never a passive chore. Identity cards live in the Vision tab now.
export default function PracticeScreen() {
  useSettings();
  const locale = "en-US";
  const [logOpen, setLogOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [dailyRecapOpen, setDailyRecapOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [events, setEvents] = useState<PositiveEvent[]>([]);

  const [recapDoneKey, setRecapDoneKey] = useState<string | null>(null);

  async function loadEvents() {
    setEvents(await getEvents());
  }

  // On launch (and whenever this screen mounts), just load the data — the
  // recap card shows itself when there's a past week pending, but opening it
  // is always the user's own tap, never automatic.
  useEffect(() => {
    (async () => {
      const [ev, done] = await Promise.all([
        getEvents(),
        AsyncStorage.getItem("recapDoneV2"),
      ]);
      setEvents(ev);
      setRecapDoneKey(done);
    })();
  }, []);

  // Only PAST, completed weeks are up for recap — this week (Monday through
  // today) is still unfolding and stays untouched. A moment from an earlier
  // skipped week still deserves a review; it shouldn't sit forever unreviewed
  // just because it isn't Sunday.
  const today = dateKey();
  const weekStart = currentWeekStart();
  const weekEvents = events.filter((e) => e.date < weekStart);

  // The recap stays available as long as past-week moments are piling up
  // unreviewed, so the flow never grows into an overwhelming archive. Once
  // you've been through it today it rests until tomorrow, and clearing
  // removes it for good.
  const showRecap = weekEvents.length > 0 && recapDoneKey !== today;

  // The daily recap now covers every day of the current week up through
  // today — not just today — so a day you missed opening it on is still one
  // tap away instead of quietly falling into a gap between "today" and the
  // weekly recap (which only ever looks at fully past weeks).
  const weekSoFarEvents = events.filter((e) => e.date >= weekStart && e.date <= today);
  const showDailyRecap = weekSoFarEvents.length > 0;

  async function markRecapDone() {
    await AsyncStorage.setItem("recapDoneV2", today);
    setRecapDoneKey(today);
  }
  async function clearWeek() {
    await deleteEvents(weekEvents.map((e) => e.id));
    await loadEvents();
    await markRecapDone();
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.logoWrap}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </View>

      {/* Settings never earned its own tab — a quiet button in the header is
          all the room it needs. Three small dots (the app's own constellation
          language) instead of a literal gear, which read out of place
          against the warm, hand-drawn register everywhere else. */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{"Today"}</Text>
          <Text style={styles.date}>{prettyDate(new Date(), locale)}</Text>
        </View>
        <Pressable onPress={() => setSettingsOpen(true)} hitSlop={12} style={styles.gearBtn}>
          <View style={styles.gearDot} />
          <View style={styles.gearDot} />
          <View style={styles.gearDot} />
        </Pressable>
      </View>

      {/* Notice a positive sign */}
      <Pressable style={styles.logRow} onPress={() => setLogOpen(true)}>
        <Text style={styles.spark}>✦</Text>
        <Text style={styles.logText}>{"Note a positive sign today…"}</Text>
        <Text style={styles.plus}>＋</Text>
      </Pressable>

      {/* The daily recap is the day's one warm accentSoft "hero" — replaying
          the day is the core repetition ritual, so it carries the weight the
          Daily Listen tile used to. Only shows once today has something to
          replay. */}
      {showDailyRecap && (
        <Pressable style={styles.primaryTile} onPress={() => setDailyRecapOpen(true)}>
          <Text style={styles.primaryTitle}>{"Day's Recap"}</Text>
          <Text style={styles.play}>▶</Text>
        </Pressable>
      )}

      {/* Weekly recap — reviews past, completed weeks whenever they pile up.
          Same slim-row language as the mirror/quote rows above (user-picked
          style B): the ritual announces itself by appearing at all, not by
          shouting in solid accent. */}
      {showRecap && (
        <Pressable style={styles.mirrorRow} onPress={() => setRecapOpen(true)}>
          <Text style={styles.mirrorGlyph}>◔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.mirrorTitle}>{"Weekly Recap"}</Text>
            <Text style={styles.mirrorSub}>
              {weekEvents.length} {"relive the week"}
            </Text>
          </View>
          <Text style={styles.play}>▶</Text>
        </Pressable>
      )}

      <LogEventSheet
        visible={logOpen}
        onClose={() => {
          setLogOpen(false);
          loadEvents();
        }}
      />
      <WeeklyRecap
        visible={recapOpen}
        events={weekEvents}
        onClose={() => setRecapOpen(false)}
        onCleared={clearWeek}
      />
      <DailyRecap
        visible={dailyRecapOpen}
        events={weekSoFarEvents}
        onClose={() => setDailyRecapOpen(false)}
      />
      <Modal visible={settingsOpen} animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.settingsWrap}>
          <Pressable style={styles.settingsClose} hitSlop={12} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.settingsCloseTxt}>✕</Text>
          </Pressable>
          <SettingsScreen />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  logoWrap: { alignItems: "center", marginTop: spacing.sm, marginBottom: spacing.md },
  logo: { width: 72, height: 72, borderRadius: 16 },
  kicker: {
    color: colors.accent,
    fontSize: font.label,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  date: { color: colors.text, fontSize: font.heading, fontWeight: "700", marginTop: 2 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  gearDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textFaint },
  settingsWrap: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing.xl * 1.6 },
  settingsClose: { position: "absolute", top: spacing.xl * 2, right: spacing.lg, zIndex: 6 },
  settingsCloseTxt: { color: colors.textMuted, fontSize: font.heading, fontWeight: "600" },


  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  spark: { color: colors.success, fontSize: font.body },
  logText: { flex: 1, color: colors.textFaint, fontSize: font.body },
  plus: { color: colors.textMuted, fontSize: font.heading },

  mirrorRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  mirrorGlyph: { color: colors.accent, fontSize: font.heading, marginRight: spacing.sm },
  mirrorTitle: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  mirrorSub: { color: colors.textFaint, fontSize: font.caption, marginTop: 1 },

  // One shared arrow, one size, everywhere it appears on this screen.
  play: { color: colors.accent, fontSize: font.heading, marginLeft: spacing.md },

  // The day's one "hero" card (the daily recap) uses the larger type tier;
  // every other row on this screen uses the smaller tier above.
  primaryTile: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  primaryTitle: { flex: 1, color: colors.text, fontSize: font.heading, fontWeight: "700" },
});
