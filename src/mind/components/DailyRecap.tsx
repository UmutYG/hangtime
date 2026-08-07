import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, Animated, Easing, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, cardTints, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { PositiveEvent } from "../lib/events";
import { dateKey, shortWeekday } from "../lib/dates";
import { generateDailyRecap, RecapData, RecapSection } from "../lib/claude";

const CACHE_KEY = "dailyRecap:v2";

type Scene =
  | { kind: "intro" }
  | { kind: "section"; section: RecapSection }
  | { kind: "closing" };

type Phase = "confirm" | "loading" | "ready" | "error";

// A lighter, same-theme sibling of the weekly recap: a look back at any day
// in the current, still-unfolding week — not just today. Generation is never
// automatic: a day without a cached recap yet shows a plain "want this
// written?" ask first, and writing it can be cancelled mid-flight. Each day
// is cached on its own once written; past, completed weeks stay the weekly
// recap's job.
export function DailyRecap({
  visible,
  events,
  onClose,
}: {
  visible: boolean;
  events: PositiveEvent[];
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const dates = useMemo(
    () => Array.from(new Set(events.map((e) => e.date))).sort(),
    [events]
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("confirm");
  const [data, setData] = useState<RecapData | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Default to the most recent day whenever the sheet opens fresh.
  useEffect(() => {
    if (visible) setSelectedDate(dates[dates.length - 1] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Switching days (or opening the sheet) never writes anything by itself —
  // it only checks whether this day already has a cached recap. No cache?
  // It waits at "confirm" until the user explicitly asks for it.
  useEffect(() => {
    abortRef.current?.abort();
    if (!visible || !selectedDate) return;
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        if (map[selectedDate]) {
          if (alive) {
            setData(map[selectedDate]);
            setPhase("ready");
          }
          return;
        }
      } catch {}
      if (alive) setPhase("confirm");
    })();
    return () => {
      alive = false;
    };
  }, [visible, selectedDate]);

  // The only path that ever calls the model. Triggered by the user tapping
  // "Oluştur" (first write) or "Yeniden oluştur" (explicit rewrite) — never
  // by opening the sheet or switching days.
  async function generate() {
    if (!selectedDate) return;
    const dayEvents = events.filter((e) => e.date === selectedDate);

    if (!settings.apiKey) {
      setData({
        sections: [
          { visionId: null, title: "General awareness", narrative: "", points: dayEvents.map((e) => e.text) },
        ],
        closing: "",
      });
      setPhase("ready");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("loading");
    setErrMsg(null);
    try {
      const recap = await generateDailyRecap(
        settings.apiKey,
        dayEvents,
        controller.signal
      );
      setData(recap);
      setPhase("ready");
      AsyncStorage.getItem(CACHE_KEY)
        .then((raw) => {
          const map = raw ? JSON.parse(raw) : {};
          map[selectedDate] = recap;
          return AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
        })
        .catch(() => {});
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setPhase("confirm"); // a real cancel, not a failure — just wait again
        return;
      }
      setErrMsg(e?.message ?? String(e));
      setPhase("error");
    }
  }

  function cancelGeneration() {
    abortRef.current?.abort();
  }

  const dayEventCount = selectedDate ? events.filter((e) => e.date === selectedDate).length : 0;
  const today = dateKey();
  const locale = "en-US";
  const dayLabel = (d: string) => (d === today ? "Today" : shortWeekday(d, locale));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {!selectedDate ? null : phase === "confirm" ? (
        <ConfirmScreen
          dates={dates}
          selectedDate={selectedDate}
          dayLabel={dayLabel}
          onSelectDate={setSelectedDate}
          momentCount={dayEventCount}
          onClose={onClose}
          onGenerate={generate}
        />
      ) : phase === "loading" ? (
        <RecapLoading
          onClose={onClose}
          onCancel={cancelGeneration}
          label={"Building the day's recap…"}
        />
      ) : phase === "error" ? (
        <View style={styles.errWrap}>
          <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
          <Text style={styles.errTxt}>{"Couldn't generate just now. Try again shortly."}</Text>
          {!!errMsg && <Text style={styles.errDetail}>[{errMsg}]</Text>}
          <Pressable style={styles.keepBtn} onPress={onClose}>
            <Text style={styles.keepTxt}>{"Close"}</Text>
          </Pressable>
        </View>
      ) : data ? (
        <DailyStories
          data={data}
          momentCount={dayEventCount}
          dates={dates}
          selectedDate={selectedDate}
          dayLabel={dayLabel}
          onSelectDate={setSelectedDate}
          onClose={onClose}
          onRegenerate={generate}
        />
      ) : null}
    </Modal>
  );
}

// The explicit ask, shown instead of writing anything automatically. Also
// carries the day-pill row so switching to another uncached day just shows
// this same screen again for that day, never a silent fetch.
function ConfirmScreen({
  dates,
  selectedDate,
  dayLabel,
  onSelectDate,
  momentCount,
  onClose,
  onGenerate,
}: {
  dates: string[];
  selectedDate: string;
  dayLabel: (d: string) => string;
  onSelectDate: (d: string) => void;
  momentCount: number;
  onClose: () => void;
  onGenerate: () => void;
}) {
  return (
    <View style={styles.confirmWrap}>
      <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
        <Text style={styles.closeTxt}>✕</Text>
      </Pressable>

      {dates.length > 1 && (
        <View style={styles.dayPillsConfirm}>
          {dates.map((d) => {
            const active = d === selectedDate;
            return (
              <Pressable
                key={d}
                style={[styles.dayPill, active && styles.dayPillActive]}
                onPress={() => onSelectDate(d)}
              >
                <Text style={[styles.dayPillTxt, active && styles.dayPillTxtActive]}>{dayLabel(d)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.confirmBody}>
        <Text style={styles.kicker}>{dayLabel(selectedDate)}</Text>
        <Text style={styles.confirmTitle}>{"Write this day's recap?"}</Text>
        <Text style={styles.confirmSub}>
          {momentCount} {"moments"} · {"Not made yet — happy to write it now if you'd like."}
        </Text>
        <Pressable style={styles.doneBtn} onPress={onGenerate}>
          <Text style={styles.doneTxt}>{"Create"}</Text>
        </Pressable>
        <Pressable style={styles.keepBtn} onPress={onClose}>
          <Text style={styles.keepTxt}>{"Close"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Calm, alive loading: cycle the user's visions while the recap is written.
// A cancel link stays available the whole time — writing this is never a
// trap you have to sit through.
function RecapLoading({
  label,
  onClose,
  onCancel,
}: {
  label: string;
  onClose: () => void;
  onCancel: () => void;
}) {
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const pool = [label];

  useEffect(() => {
    let idx = 0;
    const animate = () => {
      fade.setValue(0);
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(fade, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start(() => {
        idx = (idx + 1) % pool.length;
        setI(idx);
        animate();
      });
    };
    animate();
    return () => fade.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.loadWrap}>
      <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
        <Text style={styles.closeTxt}>✕</Text>
      </Pressable>
      <Text style={styles.loadLabel}>{label}</Text>
      <Animated.Text style={[styles.loadVision, { opacity: fade }]}>{pool[i]}</Animated.Text>
      <Pressable style={styles.cancelLink} onPress={onCancel} hitSlop={8}>
        <Text style={styles.cancelTxt}>{"Cancel"}</Text>
      </Pressable>
    </View>
  );
}

// Tap-through stories: intro → one per section → closing. Closing offers a
// regenerate action instead of the weekly recap's delete-and-confirm flow.
// A day-pill row (visible in every scene) lets you switch which day of the
// current week you're looking at without leaving the sheet.
function DailyStories({
  data,
  momentCount,
  dates,
  selectedDate,
  dayLabel,
  onSelectDate,
  onClose,
  onRegenerate,
}: {
  data: RecapData;
  momentCount: number;
  dates: string[];
  selectedDate: string;
  dayLabel: (d: string) => string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
  onRegenerate: () => void;
}) {
  const scenes = useMemo<Scene[]>(() => {
    const ordered = [...data.sections].sort((a, b) => {
      const av = a.visionId ? 0 : 1;
      const bv = b.visionId ? 0 : 1;
      return av - bv;
    });
    return [
      { kind: "intro" },
      ...ordered.map((s) => ({ kind: "section", section: s }) as Scene),
      { kind: "closing" },
    ];
  }, [data]);

  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const scene = scenes[index];
  const isClosing = scene.kind === "closing";
  const isFirst = index === 0;

  function tintFor(visionId: string | null) {
    if (!visionId) return cardTints[2];
    return cardTints[2];
  }

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Switching days always re-enters at the start of that day's story.
  function selectDate(d: string) {
    setIndex(0);
    onSelectDate(d);
  }

  function goNext() {
    if (index < scenes.length - 1) setIndex(index + 1);
  }
  function goPrev() {
    if (index > 0) setIndex(index - 1);
  }

  const tint = scene.kind === "section" ? tintFor(scene.section.visionId) : cardTints[2];
  const slideY = fade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <View style={[styles.wrap, { backgroundColor: scene.kind === "section" ? tint.bg : colors.bg }]}>
      <View style={styles.bars}>
        {scenes.map((_, i) => (
          <View key={i} style={styles.barTrack}>
            <View style={[styles.barFill, { width: i <= index ? "100%" : "0%" }]} />
          </View>
        ))}
      </View>
      <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
        <Text style={styles.closeTxt}>✕</Text>
      </Pressable>

      {dates.length > 1 && (
        <View style={styles.dayPills}>
          {dates.map((d) => {
            const active = d === selectedDate;
            return (
              <Pressable
                key={d}
                style={[styles.dayPill, active && styles.dayPillActive]}
                onPress={() => selectDate(d)}
              >
                <Text style={[styles.dayPillTxt, active && styles.dayPillTxtActive]}>{dayLabel(d)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isClosing && (
          <>
            <Pressable style={styles.zoneLeft} onPress={goPrev} />
            <Pressable style={styles.zoneRight} onPress={goNext} />
          </>
        )}
        <Animated.View style={[styles.scene, { opacity: fade, transform: [{ translateY: slideY }] }]}>
          {scene.kind === "intro" && (
            <>
              <Text style={styles.kicker}>{"Day"}</Text>
              <Text style={styles.introTitle}>{"Day's Recap"}</Text>
              <Text style={styles.introSub}>
                {momentCount} {"review the moments"}
              </Text>
            </>
          )}

          {scene.kind === "section" && (
            <>
              <Text style={[styles.sectionTitle, { color: tint.fg }]}>{scene.section.title}</Text>
              {!!scene.section.narrative && <Text style={styles.narrative}>{scene.section.narrative}</Text>}
              {scene.section.points.map((p, j) => (
                <View key={j} style={styles.pointRow}>
                  <Text style={[styles.spark, { color: tint.fg }]}>✦</Text>
                  <Text style={styles.pointText}>{p}</Text>
                </View>
              ))}
            </>
          )}

          {isClosing && (
            <>
              {!!data.closing && <Text style={styles.closing}>{data.closing}</Text>}
              <Text style={styles.reassure}>{"This stays here, nothing gets deleted. Add something new during the day and you can regenerate it."}</Text>
              <Pressable style={styles.doneBtn} onPress={onClose}>
                <Text style={styles.doneTxt}>{"Close"}</Text>
              </Pressable>
              <Pressable style={styles.keepBtn} onPress={onRegenerate}>
                <Text style={styles.keepTxt}>{"↻ Regenerate"}</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </ScrollView>

      {!isClosing && (
        <View style={styles.navRow}>
          <Pressable
            style={[styles.navBtn, isFirst && styles.navBtnHidden]}
            onPress={goPrev}
            disabled={isFirst}
          >
            <Text style={styles.navTxt}>‹ {"Back"}</Text>
          </Pressable>
          <Pressable style={[styles.navBtn, styles.navBtnPrimary]} onPress={goNext}>
            <Text style={[styles.navTxt, styles.navTxtPrimary]}>{"Next"} ›</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  bars: {
    paddingTop: spacing.xl * 1.6,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    gap: 4,
  },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.12)", overflow: "hidden" },
  barFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
  close: { position: "absolute", top: spacing.xl * 2, right: spacing.lg, zIndex: 6 },
  closeTxt: { color: colors.textMuted, fontSize: font.heading, fontWeight: "600" },

  dayPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  // ConfirmScreen has no progress-bar row above it (unlike DailyStories) to
  // clear the status bar/notch, so it needs its own top clearance — enough
  // to sit level with the ✕ close button instead of sitting under it.
  dayPillsConfirm: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl * 2,
  },
  dayPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  dayPillActive: { backgroundColor: colors.text, borderColor: colors.text },
  dayPillTxt: { color: colors.textMuted, fontSize: font.caption, fontWeight: "700" },
  dayPillTxtActive: { color: colors.bg },

  confirmWrap: { flex: 1, backgroundColor: colors.bg },
  confirmBody: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl },
  confirmTitle: { color: colors.text, fontSize: font.title, fontWeight: "800", marginTop: spacing.sm },
  confirmSub: { color: colors.textMuted, fontSize: font.body, lineHeight: 23, marginTop: spacing.sm },

  scroll: { flex: 1 },
  zoneLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", zIndex: 2 },
  zoneRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", zIndex: 2 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  scene: { gap: spacing.sm },
  kicker: {
    color: colors.accent,
    fontSize: font.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  introTitle: { color: colors.text, fontSize: font.title + 8, fontWeight: "800" },
  introSub: { color: colors.textMuted, fontSize: font.body, marginTop: spacing.xs },
  sectionTitle: { fontSize: font.title, fontWeight: "800", lineHeight: 36 },
  narrative: { color: colors.text, fontSize: font.heading, lineHeight: 30, marginTop: spacing.md },
  pointRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  spark: { fontSize: font.body },
  pointText: { flex: 1, color: colors.text, fontSize: font.body, lineHeight: 24 },

  closing: { color: colors.text, fontSize: font.title, fontWeight: "800", lineHeight: 36 },
  reassure: { color: colors.textMuted, fontSize: font.body, lineHeight: 25, marginTop: spacing.md },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  doneTxt: { color: colors.onAccent, fontSize: font.body, fontWeight: "700" },
  keepBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: "center" },
  keepTxt: { color: colors.textFaint, fontSize: font.label },

  navRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  navBtn: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  navBtnHidden: { opacity: 0 },
  navBtnPrimary: { backgroundColor: colors.text, borderColor: colors.text },
  navTxt: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  navTxtPrimary: { color: colors.bg },

  loadWrap: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  loadLabel: {
    color: colors.accent,
    fontSize: font.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.lg,
  },
  loadVision: {
    color: colors.text,
    fontSize: font.heading,
    fontWeight: "700",
    lineHeight: 30,
    textAlign: "center",
  },
  cancelLink: { marginTop: spacing.xl, paddingVertical: spacing.sm },
  cancelTxt: { color: colors.textFaint, fontSize: font.label },

  errWrap: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: spacing.md },
  errTxt: { color: colors.textMuted, fontSize: font.body },
  errDetail: {
    color: colors.textFaint,
    fontSize: font.caption,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    lineHeight: 17,
  },
});
