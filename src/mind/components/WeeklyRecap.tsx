import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, Animated, Easing, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, cardTints, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { PositiveEvent } from "../lib/events";
import { generateWeeklyRecap, RecapData, RecapSection } from "../lib/claude";
import { buildInnerNotes } from "../lib/innerMap";
import { Field } from "./ui";

const CACHE_KEY = "weeklyRecap:v1";

type Scene =
  | { kind: "intro" }
  | { kind: "section"; section: RecapSection }
  | { kind: "closing" };

// A Spotify-Wrapped-style review of the week: tap through one story per vision,
// each reflecting back who you're becoming. While it's being written, a calm
// screen cycles your visions so the wait feels alive. At the end you can let the
// week go and start clean.
export function WeeklyRecap({
  visible,
  events,
  onClose,
  onCleared,
}: {
  visible: boolean;
  events: PositiveEvent[];
  onClose: () => void;
  onCleared: () => void;
}) {
  const { t, lang, settings } = useSettings();
  const [phase, setPhase] = useState<"confirm" | "loading" | "ready" | "error">("confirm");
  const [data, setData] = useState<RecapData | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Opening only READS: a cached recap shows immediately, everything else
  // parks at a plain "want this written?" ask. Writing the week is the
  // single most expensive call in the app (exhaustive, up to 8k tokens), so
  // it fires only on the user's own tap — same contract as the daily recap,
  // and a ritual entered by choice reads less like a chore anyway.
  useEffect(() => {
    if (!visible) {
      abortRef.current?.abort();
      return;
    }
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.count === events.length) {
            if (alive) {
              setData(cached.data);
              setPhase("ready");
            }
            return;
          }
        }
      } catch {}

      // Without a key there's nothing to generate — show the plain listing.
      if (!settings.apiKey) {
        if (alive) {
          setData({
            sections: [
              { visionId: null, title: t("recap.general"), narrative: "", points: events.map((e) => e.text) },
            ],
            closing: "",
          });
          setPhase("ready");
        }
        return;
      }

      if (alive) setPhase("confirm");
    })();
    return () => {
      alive = false;
    };
  }, [visible, events.length]);

  async function generate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("loading");
    setErrMsg(null);
    try {
      const notes = await buildInnerNotes().catch(() => []);
      const recap = await generateWeeklyRecap(
        settings.apiKey,
        lang,
        settings.visionCards,
        events,
        controller.signal,
        notes
      );
      // Cache FIRST, then update state: a close mid-generation used to hit
      // the alive-check before the cache write, billing the full call and
      // then throwing the result away.
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ count: events.length, data: recap })
      ).catch(() => {});
      setData(recap);
      setPhase("ready");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setPhase("confirm"); // a real cancel, not an error
        return;
      }
      setErrMsg(e?.message ?? String(e));
      setPhase("error");
    }
  }

  function cancelGeneration() {
    abortRef.current?.abort();
  }

  async function clearWeek() {
    await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    onCleared();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {phase === "confirm" ? (
        <View style={styles.confirmWrap}>
          <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
          <Text style={styles.confirmTitle}>{t("recap.writeTitle")}</Text>
          <Text style={styles.confirmSub}>
            {events.length} {t("recap.cardSub")} — {t("recap.writeSub")}
          </Text>
          <Pressable style={styles.doneBtn} onPress={generate}>
            <Text style={styles.doneTxt}>{t("recap.writeBtn")}</Text>
          </Pressable>
          <Pressable style={styles.keepBtn} onPress={onClose}>
            <Text style={styles.keepTxt}>{t("common.close")}</Text>
          </Pressable>
        </View>
      ) : phase === "loading" ? (
        <RecapLoading
          visions={settings.visionCards.map((c) => c.text)}
          onClose={() => {
            cancelGeneration();
            onClose();
          }}
          label={t("recap.building")}
        />
      ) : phase === "error" ? (
        <View style={styles.errWrap}>
          <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
          <Text style={styles.errTxt}>{t("reflect.error")}</Text>
          {!!errMsg && <Text style={styles.errDetail}>[{errMsg}]</Text>}
          <Pressable style={styles.keepBtn} onPress={onClose}>
            <Text style={styles.keepTxt}>{t("common.close")}</Text>
          </Pressable>
        </View>
      ) : (
        <RecapStories
          data={data!}
          visionCards={settings.visionCards}
          momentCount={events.length}
          onClose={onClose}
          onClear={clearWeek}
        />
      )}
    </Modal>
  );
}

// Calm, alive loading: cycle the user's visions while the recap is written.
function RecapLoading({ visions, label, onClose }: { visions: string[]; label: string; onClose: () => void }) {
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const pool = visions.length ? visions : [label];

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
    </View>
  );
}

// Tap-through stories: intro → one per section → closing.
function RecapStories({
  data,
  visionCards,
  momentCount,
  onClose,
  onClear,
}: {
  data: RecapData;
  visionCards: { id: string; tint: number }[];
  momentCount: number;
  onClose: () => void;
  onClear: () => void;
}) {
  const { t } = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmWord = t("recap.confirmWord");
  const confirmOk =
    confirmText.trim().toLocaleLowerCase("tr") === confirmWord.toLocaleLowerCase("tr");
  const scenes = useMemo<Scene[]>(() => {
    // The parts that connect back to a vision are the point — put them first;
    // the catch-all "general awareness" section (visionId null) trails behind.
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
    const card = visionCards.find((c) => c.id === visionId);
    return cardTints[(card?.tint ?? 0) % cardTints.length];
  }

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tap zones live INSIDE the ScrollView's content (not layered on top
            of it), so a scroll gesture is claimed by the ScrollView as usual
            and only a genuine tap fires navigation — Instagram-stories style,
            without breaking scrolling for long text. */}
        {!isClosing && (
          <>
            <Pressable style={styles.zoneLeft} onPress={goPrev} />
            <Pressable style={styles.zoneRight} onPress={goNext} />
          </>
        )}
        <Animated.View style={[styles.scene, { opacity: fade, transform: [{ translateY: slideY }] }]}>
          {scene.kind === "intro" && (
            <>
              <Text style={styles.kicker}>{t("recap.kicker")}</Text>
              <Text style={styles.introTitle}>{t("recap.cardTitle")}</Text>
              <Text style={styles.introSub}>
                {momentCount} {t("recap.cardSub")}
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

          {isClosing && !confirming && (
          <>
            {!!data.closing && <Text style={styles.closing}>{data.closing}</Text>}
            <Text style={styles.reassure}>{t("recap.reassure")}</Text>
            <Pressable style={styles.doneBtn} onPress={() => setConfirming(true)}>
              <Text style={styles.doneTxt}>{t("recap.clear")}</Text>
            </Pressable>
            <Pressable style={styles.keepBtn} onPress={onClose}>
              <Text style={styles.keepTxt}>{t("recap.keep")}</Text>
            </Pressable>
          </>
        )}

        {isClosing && confirming && (
          <>
            <Text style={styles.closing}>{t("recap.confirmTitle")}</Text>
            <Text style={styles.reassure}>
              {t("recap.confirmPrompt")} “{confirmWord}”
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Field
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={confirmWord}
                autoCapitalize="sentences"
                autoFocus
              />
            </View>
            <Pressable
              style={[styles.doneBtn, !confirmOk && styles.doneBtnOff]}
              onPress={() => confirmOk && onClear()}
              disabled={!confirmOk}
            >
              <Text style={styles.doneTxt}>{t("recap.confirmBtn")}</Text>
            </Pressable>
            <Pressable style={styles.keepBtn} onPress={() => setConfirming(false)}>
              <Text style={styles.keepTxt}>{t("common.cancel")}</Text>
            </Pressable>
          </>
        )}
        </Animated.View>
      </ScrollView>

      {/* Manual navigation — no auto-advance; this is meant to be read. */}
      {!isClosing && (
        <View style={styles.navRow}>
          <Pressable
            style={[styles.navBtn, isFirst && styles.navBtnHidden]}
            onPress={goPrev}
            disabled={isFirst}
          >
            <Text style={styles.navTxt}>‹ {t("recap.back")}</Text>
          </Pressable>
          <Pressable style={[styles.navBtn, styles.navBtnPrimary]} onPress={goNext}>
            <Text style={[styles.navTxt, styles.navTxtPrimary]}>{t("recap.next")} ›</Text>
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
  doneBtnOff: { opacity: 0.4 },
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

  confirmWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: spacing.xl,
  },
  confirmTitle: { color: colors.text, fontSize: font.title, fontWeight: "800", lineHeight: 36 },
  confirmSub: { color: colors.textMuted, fontSize: font.body, lineHeight: 24, marginTop: spacing.sm },

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
