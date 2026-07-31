import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, cardTints, font, radius, spacing } from "../lib/theme";
import { currentWeekStart } from "../lib/dates";
import { useSettings } from "../lib/SettingsContext";
import { VisionCard, newCard } from "../lib/settings";
import { Card, Field, Label } from "../components/ui";
import {
  askedToday,
  markAskedToday,
  reflectionCounts,
  saveVisionReflection,
} from "../lib/visionReflections";
import { getMirrorThanksLines } from "../lib/lines";
import { getWhyQuestions } from "../lib/whyQuestions";

const WHY_QUESTIONS = [
  "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12",
] as const;

// A generous hard ceiling — the earlier hard cap of 4 felt like
// over-restriction. The real regulator is archiving plus a soft nudge:
const MAX_CARDS = 10;
// Past this, a gentle reminder that fewer is usually better appears — the
// book keeps focus narrow (importance/attention scatter), and long decks
// also stretch the mirror feed and daily recaps. The default vision + ~5 of
// your own is usually plenty; archiving is the natural pressure valve —
// ordinary-feeling slides move aside, restorable from Settings any time.
const SOFT_CARDS = 6;

// The Vision tab is just a calm place to hold who you are becoming — nothing
// else. Add, edit (in a popup), archive (never hard-delete: a slide leaving
// the wall goes to the archive, same as the weekly dissolve ritual).
export default function VisionScreen() {
  const { t, settings, update } = useSettings();
  // Single source of truth: settings.visionCards straight from context —
  // the old local `cards` mirror was a second copy that could drift.
  const cards = settings.visionCards;
  const [draft, setDraft] = useState("");
  const [principlesOpen, setPrinciplesOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  // The dream portrait editor — opened from its own card, prefilled with
  // whatever is already written so every visit is an embellishment, not a
  // rewrite from scratch.
  const [dreamDraft, setDreamDraft] = useState<string | null>(null);
  const [why, setWhy] = useState<{ card: VisionCard; question: string } | null>(null);
  const [whyAnswer, setWhyAnswer] = useState("");
  const [whyThanks, setWhyThanks] = useState(false);
  const [thanksLine, setThanksLine] = useState("");
  const [thanksPool, setThanksPool] = useState<string[]>([]);
  // The weekly dissolve check (the book: once a slide feels ordinary and
  // yours, it has done its work). One card a week, one tap to answer.
  const [dissolve, setDissolve] = useState<VisionCard | null>(null);
  const [dissolveScore, setDissolveScore] = useState<number | null>(null);

  // The acknowledgment pool renews itself weekly via Claude (cached) —
  // the same "closer to the mirror" motivation in fresh words, seasoned by
  // the user's own past answers. The static lines are the offline floor.
  useEffect(() => {
    const fallback = [1, 2, 3, 4, 5].map((i) => t(`vision.why.thanks${i}`));
    getMirrorThanksLines(settings.language, settings.apiKey, fallback).then(setThanksPool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.apiKey]);

  // Occasionally (at most twice a day) ask why a vision is yours — to catch
  // goals adopted from others. Pick the least-examined card; the question
  // comes from a weekly self-renewing pool shaped by the person's own inner
  // map (static q1..q10 as the offline floor), so the asking itself evolves.
  // Deliberately mount-only: keying this on visionCards made every card
  // edit re-run the whole ask chain and could swap the on-screen question
  // mid-answer. Settings are loaded before the Shell renders, so the cards
  // are already here on mount.
  useEffect(() => {
    const cardsNow = settings.visionCards;
    if (cardsNow.length === 0) return;
    (async () => {
      if (await askedToday()) return;
      const counts = await reflectionCounts();
      const card = [...cardsNow].sort(
        (a, b) => (counts[a.id] ?? 0) - (counts[b.id] ?? 0)
      )[0];
      const fallback = WHY_QUESTIONS.map((k) => t("vision.why." + k));
      // The wall itself rides along: the pool regenerates when a vision is
      // added/edited/archived, so a question never echoes an archived slide
      // beneath a new one.
      const pool = await getWhyQuestions(settings.language, settings.apiKey, fallback, cardsNow);
      setWhy({ card, question: pool[Math.floor(Math.random() * pool.length)] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once a week (and only when the daily "why" isn't already on screen),
  // ask how ordinary-and-yours one slide feels by now.
  useEffect(() => {
    const cardsNow = settings.visionCards;
    if (cardsNow.length === 0 || why) return;
    (async () => {
      const week = currentWeekStart();
      const asked = await AsyncStorage.getItem("dissolveAskedWeek");
      if (asked === week) return;
      const raw = await AsyncStorage.getItem("dissolveRatings:v1").catch(() => null);
      const ratings: Record<string, { score: number; at: number }> = raw ? JSON.parse(raw) : {};
      // Oldest-rated (or never-rated) card first.
      const card = [...cardsNow].sort(
        (a, b) => (ratings[a.id]?.at ?? 0) - (ratings[b.id]?.at ?? 0)
      )[0];
      setDissolve(card);
    })();
  }, [settings.visionCards, why]);

  async function rateDissolve(score: number) {
    if (!dissolve) return;
    setDissolveScore(score);
    await AsyncStorage.setItem("dissolveAskedWeek", currentWeekStart());
    try {
      const raw = await AsyncStorage.getItem("dissolveRatings:v1");
      const ratings = raw ? JSON.parse(raw) : {};
      ratings[dissolve.id] = { score, at: Date.now() };
      await AsyncStorage.setItem("dissolveRatings:v1", JSON.stringify(ratings));
    } catch {}
    // Below the threshold there's nothing to decide — a soft nudge, then gone.
    if (score < 4) {
      setTimeout(() => {
        setDissolve(null);
        setDissolveScore(null);
      }, 3200);
    }
  }

  async function archiveCard() {
    if (!dissolve) return;
    await update({
      visionCards: cards.filter((c) => c.id !== dissolve.id),
      archivedVisions: [...settings.archivedVisions, dissolve],
    });
    setDissolve(null);
    setDissolveScore(null);
  }

  function keepCard() {
    setDissolve(null);
    setDissolveScore(null);
  }

  async function saveWhy() {
    if (!why) return;
    const answer = whyAnswer.trim();
    if (answer) {
      await saveVisionReflection({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        cardId: why.card.id,
        question: why.question,
        answer,
        createdAt: Date.now(),
      });
    }
    await markAskedToday();
    // A warm acknowledgment that lingers — drawn from the self-renewing
    // pool, never the same stock reply.
    const pool = thanksPool.length
      ? thanksPool
      : [1, 2, 3, 4, 5].map((i) => t(`vision.why.thanks${i}`));
    setThanksLine(pool[Math.floor(Math.random() * pool.length)]);
    setWhyThanks(true);
    setTimeout(() => {
      setWhy(null);
      setWhyAnswer("");
      setWhyThanks(false);
    }, 3600);
  }
  async function dismissWhy() {
    await markAskedToday();
    setWhy(null);
    setWhyAnswer("");
  }

  async function persistCards(next: VisionCard[]) {
    await update({ visionCards: next });
  }

  function addCard() {
    const v = draft.trim();
    if (!v || cards.length >= MAX_CARDS) return;
    persistCards([...cards, newCard(v, cards.length % cardTints.length)]);
    setDraft("");
  }
  // A card never hard-deletes — it moves to the archive (restorable from
  // Settings), exactly like the weekly dissolve ritual, just by hand.
  async function archiveCardById(id: string) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    await update({
      visionCards: cards.filter((c) => c.id !== id),
      archivedVisions: [...settings.archivedVisions, card],
    });
  }

  async function saveDream() {
    if (dreamDraft === null) return;
    await update({ dreamPortrait: dreamDraft.trim() });
    setDreamDraft(null);
  }

  function saveEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    if (text) {
      persistCards(cards.map((c) => (c.id === editing.id ? { ...c, text } : c)));
    }
    setEditing(null);
  }

  const atMax = cards.length >= MAX_CARDS;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t("vision.subtitle")}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("vision.title")}</Text>
          <Pressable onPress={() => setPrinciplesOpen(true)} hitSlop={12} style={styles.infoBtn}>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </Pressable>
        </View>

        {why && (
          <Card
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.accentSoft,
              borderColor: colors.accent,
            }}
          >
            {whyThanks ? (
              <View style={styles.whyThanksWrap}>
                <Text style={styles.whyThanksTxt}>{thanksLine}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.whyKicker}>{t("vision.why.kicker")}</Text>
                <Text style={styles.whyVision}>“{why.card.text}”</Text>
                <Text style={styles.whyQ}>{why.question}</Text>
                <View style={{ height: spacing.sm }} />
                <Field
                  value={whyAnswer}
                  onChangeText={setWhyAnswer}
                  placeholder={t("vision.why.placeholder")}
                  multiline
                  style={{ maxHeight: 140 }}
                />
                <View style={{ height: spacing.md }} />
                <Pressable style={styles.saveBtn} onPress={saveWhy}>
                  <Text style={styles.saveTxt}>{t("common.save")}</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={dismissWhy}>
                  <Text style={styles.cancelTxt}>{t("vision.why.dismiss")}</Text>
                </Pressable>
              </>
            )}
          </Card>
        )}

        {dissolve && !why && (
          <Card
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.accentSoft,
              borderColor: colors.accent,
            }}
          >
            {dissolveScore === null ? (
              <>
                <Text style={styles.whyKicker}>{t("vision.dissolve.kicker")}</Text>
                <Text style={styles.whyVision}>“{dissolve.text}”</Text>
                <Text style={styles.whyQ}>{t("vision.dissolve.q")}</Text>
                <View style={styles.scaleRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} style={styles.scaleDot} onPress={() => rateDissolve(n)}>
                      <Text style={styles.scaleDotTxt}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.scaleLabels}>
                  <Text style={styles.scaleLabel}>{t("vision.dissolve.low")}</Text>
                  <Text style={styles.scaleLabel}>{t("vision.dissolve.high")}</Text>
                </View>
              </>
            ) : dissolveScore >= 4 ? (
              <>
                <Text style={styles.whyKicker}>{t("vision.dissolve.kicker")}</Text>
                <Text style={styles.whyQ}>{t("vision.dissolve.readyTitle")}</Text>
                <Text style={styles.dissolveNote}>{t("vision.dissolve.readyBody")}</Text>
                <View style={{ height: spacing.md }} />
                <Pressable style={styles.saveBtn} onPress={archiveCard}>
                  <Text style={styles.saveTxt}>{t("vision.dissolve.archive")}</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={keepCard}>
                  <Text style={styles.cancelTxt}>{t("vision.dissolve.keep")}</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.whyThanksWrap}>
                <Text style={styles.whyThanksTxt}>{t("vision.dissolve.keepGoing")}</Text>
              </View>
            )}
          </Card>
        )}

        <Card style={{ marginTop: spacing.lg }}>
          <Label>{t("vision.cardsLabel")}</Label>
          <Text style={styles.hint}>{t("vision.cardHint")}</Text>

          <View style={{ marginTop: spacing.sm }}>
            {/* The permanent, non-editable vision: seeing the positive is itself
                the gift — a quiet anchor for the whole practice. Visually set
                apart (its own badge) without breaking the app's look. */}
            <View style={styles.defaultRow}>
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeTxt}>{t("vision.defaultBadge")}</Text>
              </View>
              <Text style={styles.defaultText}>{t("vision.defaultText")}</Text>
              <Text style={styles.defaultTag}>{t("vision.defaultTag")}</Text>
            </View>

            {cards.length === 0 ? (
              <Text style={styles.empty}>{t("vision.empty")}</Text>
            ) : (
              cards.map((c) => (
                <View key={c.id} style={styles.row}>
                  <Text style={styles.rowText}>{c.text}</Text>
                  <View style={styles.rowActions}>
                    <Pressable hitSlop={8} onPress={() => setEditing({ id: c.id, text: c.text })}>
                      <Text style={styles.rowActionEdit}>{t("vision.edit")}</Text>
                    </Pressable>
                    <Text style={styles.rowActionSep}>·</Text>
                    <Pressable hitSlop={8} onPress={() => archiveCardById(c.id)}>
                      <Text style={styles.rowActionDelete}>{t("vision.remove")}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: spacing.md }} />
          {cards.length >= SOFT_CARDS && !atMax && (
            <Text style={[styles.maxNote, { marginBottom: spacing.sm }]}>
              {t("vision.manyNote")}
            </Text>
          )}
          {atMax ? (
            <Text style={styles.maxNote}>{t("vision.maxNote")}</Text>
          ) : (
            <View style={styles.addRow}>
              <Field
                value={draft}
                onChangeText={setDraft}
                placeholder={t("vision.cardPlaceholder")}
                style={{ flex: 1 }}
                onSubmitEditing={addCard}
                returnKeyType="done"
              />
              <Pressable onPress={addCard} style={styles.addBtn}>
                <Text style={styles.addBtnText}>＋</Text>
              </Pressable>
            </View>
          )}
        </Card>

        {/* The dream portrait: the target slide in the person's own words,
            embellished whenever a new detail comes to them. Feeds the inner
            map, so the whole mirror sharpens as this grows. */}
        <Card style={{ marginTop: spacing.lg }}>
          <Label>{t("vision.dream.label")}</Label>
          <Text style={styles.hint}>{t("vision.dream.hint")}</Text>
          {settings.dreamPortrait.trim() ? (
            <Text style={styles.dreamText}>{settings.dreamPortrait}</Text>
          ) : (
            <Text style={styles.empty}>{t("vision.dream.empty")}</Text>
          )}
          <View style={{ height: spacing.md }} />
          <Pressable
            style={styles.dreamBtn}
            onPress={() => setDreamDraft(settings.dreamPortrait)}
          >
            <Text style={styles.dreamBtnTxt}>
              {settings.dreamPortrait.trim()
                ? t("vision.dream.addDetail")
                : t("vision.dream.write")}
            </Text>
          </Pressable>
        </Card>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Edit card — popup. KAV lives INSIDE the Modal: a Modal is its own
          native window on iOS, so the screen-level KAV can't lift this sheet
          above the keyboard. */}
      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>{t("vision.editTitle")}</Text>
              <View style={{ height: spacing.md }} />
              <Field
                value={editing?.text ?? ""}
                onChangeText={(v) => setEditing((e) => (e ? { ...e, text: v } : e))}
                autoFocus
                multiline
                placeholder={t("vision.cardPlaceholder")}
                style={{ maxHeight: 140 }}
              />

              <View style={{ height: spacing.lg }} />
              <Pressable style={styles.saveBtn} onPress={saveEdit}>
                <Text style={styles.saveTxt}>{t("common.save")}</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)}>
                <Text style={styles.cancelTxt}>{t("common.cancel")}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Dream portrait — popup. Same KAV-inside-Modal arrangement as the
          card editor, for the same iOS-native-window reason. */}
      <Modal
        visible={dreamDraft !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDreamDraft(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => setDreamDraft(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <Text style={styles.sheetTitle}>{t("vision.dream.editTitle")}</Text>
              <Text style={styles.sheetIntro}>{t("vision.dream.hint")}</Text>
              <Field
                value={dreamDraft ?? ""}
                onChangeText={setDreamDraft}
                autoFocus
                multiline
                placeholder={t("vision.dream.placeholder")}
                style={{ minHeight: 120, maxHeight: 260 }}
              />
              <View style={{ height: spacing.lg }} />
              <Pressable style={styles.saveBtn} onPress={saveDream}>
                <Text style={styles.saveTxt}>{t("common.save")}</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => setDreamDraft(null)}>
                <Text style={styles.cancelTxt}>{t("common.cancel")}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Golden rules — popup */}
      <Modal
        visible={principlesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPrinciplesOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPrinciplesOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t("vision.principlesTitle")}</Text>
            <Text style={styles.sheetIntro}>{t("vision.principlesIntro")}</Text>
            {(["p1", "p2", "p3", "p4"] as const).map((p, i) => (
              <View key={p} style={styles.principle}>
                <Text style={styles.principleNum}>{i + 1}</Text>
                <Text style={styles.principleText}>{t("vision.principle." + p)}</Text>
              </View>
            ))}
            <Pressable style={styles.saveBtn} onPress={() => setPrinciplesOpen(false)}>
              <Text style={styles.saveTxt}>{t("vision.principlesClose")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  subtitle: { color: colors.textMuted, fontSize: font.label, marginBottom: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: font.title, fontWeight: "700" },
  infoBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  infoIcon: { color: colors.accent, fontSize: font.heading },
  hint: { color: colors.textFaint, fontSize: font.caption, lineHeight: 18, marginBottom: spacing.sm },
  empty: { color: colors.textFaint, fontSize: font.body, marginTop: spacing.sm },

  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowActions: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  rowActionEdit: { color: colors.accent, fontSize: font.label, fontWeight: "600" },
  rowActionSep: { color: colors.textFaint, fontSize: font.label, marginHorizontal: spacing.xs },
  rowActionDelete: { color: colors.textFaint, fontSize: font.label },
  defaultRow: {
    backgroundColor: cardTints[1].bg,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  defaultBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  defaultBadgeTxt: {
    color: "#FFFFFF",
    fontSize: font.caption - 1,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  defaultText: {
    color: cardTints[1].fg,
    fontSize: font.body,
    fontWeight: "700",
    lineHeight: 22,
  },
  defaultTag: {
    color: cardTints[1].fg,
    fontSize: font.caption,
    opacity: 0.75,
    marginTop: 3,
  },
  rowText: { color: colors.text, fontSize: font.body, lineHeight: 22 },


  scaleRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  scaleDot: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  scaleDotTxt: { color: colors.accent, fontSize: font.body, fontWeight: "700" },
  scaleLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  scaleLabel: { color: colors.textFaint, fontSize: font.caption },
  dissolveNote: { color: colors.textMuted, fontSize: font.label, lineHeight: 20, marginTop: spacing.sm },

  maxNote: { color: colors.textFaint, fontSize: font.caption, lineHeight: 18, fontStyle: "italic" },
  dreamText: {
    color: colors.text,
    fontSize: font.body,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  dreamBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dreamBtnTxt: { color: colors.accent, fontSize: font.label, fontWeight: "700" },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: colors.accent, fontSize: 24, fontWeight: "700" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sheetTitle: { color: colors.text, fontSize: font.heading, fontWeight: "700" },
  sheetIntro: {
    color: colors.textMuted,
    fontSize: font.caption + 1,
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  principle: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.md },
  principleNum: {
    color: colors.accent,
    fontSize: font.body,
    fontWeight: "800",
    width: 18,
    textAlign: "center",
    lineHeight: 23,
  },
  principleText: { flex: 1, color: colors.text, fontSize: font.body, lineHeight: 23 },
  whyKicker: {
    color: colors.accent,
    fontSize: font.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  whyVision: {
    color: colors.textMuted,
    fontSize: font.caption + 1,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
  whyQ: { color: colors.text, fontSize: font.body, fontWeight: "600", lineHeight: 23, marginTop: spacing.sm },
  whyThanksWrap: { paddingVertical: spacing.md, alignItems: "center" },
  whyThanksTxt: {
    color: colors.accent,
    fontSize: font.body,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 23,
  },
  saveBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveTxt: { color: colors.onAccent, fontSize: font.body, fontWeight: "700" },
  cancelBtn: { marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: "center" },
  cancelTxt: { color: colors.textFaint, fontSize: font.label },
});
