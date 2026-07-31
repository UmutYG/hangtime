import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { colors, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { dateKey } from "../lib/dates";
import { addEvent, updateEvent, PositiveEvent } from "../lib/events";
import { scheduleResurface } from "../lib/notifications";
import { generateReframe, matchEventToVision } from "../lib/claude";
import { addReframe } from "../lib/reframes";
import { Field, PrimaryButton, GhostButton } from "./ui";

// Turn something the user sees as negative into a logged positive, strictly
// through the book's own lens: name the importance behind it (inner — who
// they'll be — or outer — the result), question whether it would even sting
// without that importance, then loosen it (neutral, a game, a possible unseen
// sign, and the one real moment — this breath — which means there's a choice).
type Phase = "input" | "importance" | "impact" | "reframing" | "result" | "error";

export function ReframeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, lang, settings } = useSettings();
  const [phase, setPhase] = useState<Phase>("input");
  const [negative, setNegative] = useState("");
  const [importanceAnswer, setImportanceAnswer] = useState("");
  const [impactAnswer, setImpactAnswer] = useState("");
  const [reframe, setReframe] = useState("");
  const [takeaway, setTakeaway] = useState("");

  function close() {
    setPhase("input");
    setNegative("");
    setImportanceAnswer("");
    setImpactAnswer("");
    setReframe("");
    setTakeaway("");
    onClose();
  }

  async function runReframe() {
    if (!settings.apiKey) return;
    setPhase("reframing");
    try {
      const out = await generateReframe(
        settings.apiKey,
        lang,
        negative.trim(),
        importanceAnswer.trim(),
        impactAnswer.trim()
      );
      if (!out.reframe || !out.positiveTakeaway) {
        setPhase("error");
        return;
      }
      setReframe(out.reframe);
      setTakeaway(out.positiveTakeaway);
      setPhase("result");
    } catch {
      setPhase("error");
    }
  }

  async function logTakeaway() {
    const value = takeaway.trim();
    if (!value) return close();
    const event: PositiveEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: value,
      date: dateKey(),
      createdAt: Date.now(),
    };
    await addEvent(event);
    scheduleResurface(value, lang, settings.apiKey);
    // Keep the episode for the inner map — but ONLY on the log path: logging
    // the takeaway is the person's consent that this belongs to their story;
    // a reframe they closed without keeping stays discarded. Captured before
    // close() resets the state; fire-and-forget, never blocks the button.
    addReframe({
      negative: negative.trim(),
      importanceAnswer: importanceAnswer.trim(),
      impactAnswer: impactAnswer.trim(),
      takeaway: value,
    }).catch(() => {});
    // Close right away — matching shouldn't make the button feel laggy. It
    // resolves in the background and tags the saved event ONLY on a real
    // vision match (no default-card force-fit; Flow hides unmatched tags).
    close();

    if (settings.apiKey && settings.visionCards.length > 0) {
      (async () => {
        try {
          const m = await matchEventToVision(settings.apiKey, value, settings.visionCards, lang);
          if (m.cardId) {
            await updateEvent(event.id, { matchedCardId: m.cardId, matchReason: m.reason });
          }
        } catch {}
      })();
    }
  }

  const noKey = !settings.apiKey;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {phase === "input" && (
              <>
                <Text style={styles.title}>{t("reframe.title")}</Text>
                <Text style={styles.sub}>{t("reframe.inputSub")}</Text>
                <Field
                  value={negative}
                  onChangeText={setNegative}
                  multiline
                  placeholder={t("reframe.inputPlaceholder")}
                  autoFocus
                  style={{ maxHeight: 140 }}
                />
                <View style={{ height: spacing.md }} />
                {noKey ? (
                  <Text style={styles.needKey}>{t("reframe.needKey")}</Text>
                ) : (
                  <PrimaryButton
                    title={t("reframe.next")}
                    onPress={() => negative.trim() && setPhase("importance")}
                  />
                )}
              </>
            )}

            {phase === "importance" && (
              <>
                <Text style={styles.kicker}>{t("reframe.kicker")}</Text>
                <Text style={styles.title}>{t("reframe.q1")}</Text>
                <Text style={styles.sub}>{t("reframe.q1Sub")}</Text>
                <Field
                  value={importanceAnswer}
                  onChangeText={setImportanceAnswer}
                  multiline
                  placeholder={t("vision.why.placeholder")}
                  autoFocus
                  style={{ maxHeight: 140 }}
                />
                <View style={{ height: spacing.md }} />
                <PrimaryButton title={t("reframe.next")} onPress={() => setPhase("impact")} />
              </>
            )}

            {phase === "impact" && (
              <>
                <Text style={styles.kicker}>{t("reframe.kicker")}</Text>
                <Text style={styles.title}>{t("reframe.q2")}</Text>
                <Field
                  value={impactAnswer}
                  onChangeText={setImpactAnswer}
                  multiline
                  placeholder={t("vision.why.placeholder")}
                  autoFocus
                  style={{ maxHeight: 140 }}
                />
                <View style={{ height: spacing.md }} />
                <PrimaryButton title={t("reframe.reveal")} onPress={runReframe} />
              </>
            )}

            {phase === "reframing" && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{t("reframe.working")}</Text>
              </View>
            )}

            {phase === "result" && (
              <>
                <Text style={styles.kicker}>{t("reframe.kicker")}</Text>
                <Text style={styles.reframeText}>{reframe}</Text>
                <View style={styles.takeawayBox}>
                  <Text style={styles.takeawayLabel}>{t("reframe.takeawayLabel")}</Text>
                  <Text style={styles.takeawayText}>{takeaway}</Text>
                </View>
                <View style={{ height: spacing.md }} />
                <PrimaryButton title={t("reframe.logIt")} onPress={logTakeaway} />
                <View style={{ height: spacing.sm }} />
                <GhostButton title={t("event.close")} onPress={close} />
              </>
            )}

            {phase === "error" && (
              <>
                <Text style={styles.muted}>{t("reflect.error")}</Text>
                <View style={{ height: spacing.md }} />
                <GhostButton title={t("event.close")} onPress={close} />
              </>
            )}
          </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: spacing.lg },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: Dimensions.get("window").height * 0.78,
  },
  scrollContent: { padding: spacing.lg },
  kicker: {
    color: colors.accent,
    fontSize: font.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  title: { color: colors.text, fontSize: font.heading, fontWeight: "700", lineHeight: 26 },
  sub: { color: colors.textMuted, fontSize: font.label, lineHeight: 19, marginTop: spacing.xs, marginBottom: spacing.md },
  center: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: font.body, lineHeight: 22, textAlign: "center" },
  needKey: { color: colors.textFaint, fontSize: font.caption, lineHeight: 18, textAlign: "center" },
  reframeText: { color: colors.text, fontSize: font.body, lineHeight: 25 },
  takeawayBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  takeawayLabel: {
    color: colors.accent,
    fontSize: font.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  takeawayText: { color: colors.text, fontSize: font.body, fontWeight: "600", lineHeight: 22 },
});
