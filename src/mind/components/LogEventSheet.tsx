import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors, cardTints, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { dateKey } from "../lib/dates";
import { addEvent, updateEvent, PositiveEvent } from "../lib/events";
import { scheduleResurface } from "../lib/notifications";
import { matchEventToVision } from "../lib/claude";
import { getStrengthStore } from "../lib/strengths";
import { Field, PrimaryButton } from "./ui";

// The moment of logging carries meaning again (restored 2026-07-16 after a
// brief amalgam-only period — seeing a generic "my world takes care of me"
// for something that clearly matched a dream vision felt wrong): one AI call
// decides whether the event is real evidence for a vision AND whether it's
// living proof of one of the person's own named strengths. A vision match
// shows that vision's card ("This is you."); no match falls back to the
// rotating amalgam pool — never force-fit to a default card. A strength
// match adds a reaffirmation line either way. No key → straight to amalgam,
// zero wait.
//
// Decluttered 2026-07-21: the screen no longer echoes the user's own just-
// typed words back (they know what they wrote), and the old random reassure
// line was replaced by ONE fixed instruction (event.feelPrompt) directing
// them to find the feeling and hold it gently — the single thing this
// screen actually asks of the person, styled to be read, not skimmed.
type Phase = "input" | "matching" | "affirmed";

const AMALGAM_COUNT = 6;
// ~1s longer than the original 1.8s — Ahsen's request: the extra beat gives
// the feeling-finding instruction time to actually be followed, not skimmed.
const HOLD_MS = 2800;

// Words alone get skimmed past — the body doesn't. Closing this screen is a
// held press, not a tap: a fill bar tracks the hold, a light haptic marks
// the start and midpoint, and completing it (not releasing early) is what
// closes the sheet. A brief, deliberate pause with something to feel while
// it happens, not a countdown blocking an otherwise-instant tap. Scoped to
// ONLY this screen — the one moment in the app actually asking to be felt,
// not a pattern to spread everywhere (that would just become the next
// chore, the way Strengths' noting ritual did).
function HoldToFeelButton({ label, onDone }: { label: string; onDone: () => void }) {
  const fill = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const firedMid = useRef(false);
  const [holding, setHolding] = useState(false);

  function start() {
    setHolding(true);
    firedMid.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fill.setValue(0);
    const listener = fill.addListener(({ value }) => {
      if (value > 0.5 && !firedMid.current) {
        firedMid.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });
    anim.current = Animated.timing(fill, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false, // animating width, not transform/opacity
    });
    anim.current.start(({ finished }) => {
      fill.removeListener(listener);
      if (finished) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onDone();
      }
    });
  }

  function cancel() {
    setHolding(false);
    anim.current?.stop();
    Animated.timing(fill, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  }

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <Pressable
      onPressIn={start}
      onPressOut={cancel}
      style={styles.holdBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.holdFill, { width }]} />
      <Text style={[styles.holdTxt, holding && styles.holdTxtActive]}>{label}</Text>
    </Pressable>
  );
}

export function LogEventSheet({
  visible,
  onClose,
  onNegative,
}: {
  visible: boolean;
  onClose: () => void;
  onNegative?: () => void;
}) {
  const { t, lang, settings } = useSettings();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  // cardLine: the big line in the tinted card — a matched vision's text, or
  // an amalgam. kicker: "This is you." only for a real vision match.
  const [cardLine, setCardLine] = useState("");
  const [kicker, setKicker] = useState("");
  const [reason, setReason] = useState("");
  const [strengthLine, setStrengthLine] = useState("");
  const [tint, setTint] = useState(cardTints[0]);
  const reveal = useRef(new Animated.Value(0)).current;
  const feelFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === "affirmed") {
      reveal.setValue(0);
      feelFade.setValue(0);
      // The tinted card lands first; the feel-it instruction arrives a beat
      // later — like a person pausing before speaking, never everything
      // dumped at once.
      Animated.sequence([
        Animated.timing(reveal, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.delay(450),
        Animated.timing(feelFade, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [phase, reveal, feelFade]);

  function close() {
    setText("");
    setPhase("input");
    setStrengthLine("");
    setReason("");
    onClose();
  }

  function goNegative() {
    setText("");
    setPhase("input");
    setStrengthLine("");
    setReason("");
    onNegative?.();
  }

  // No-match / no-key / error landing: the rotating amalgam pool on a random
  // Vision-palette tint. A strength reaffirmation still shows if one landed.
  function settleAmalgam(strength: string) {
    setKicker("");
    setReason("");
    setCardLine(t(`event.amalgam${1 + Math.floor(Math.random() * AMALGAM_COUNT)}`));
    setTint(cardTints[Math.floor(Math.random() * cardTints.length)]);
    setStrengthLine(strength);
    setPhase("affirmed");
  }

  async function submit() {
    const value = text.trim();
    if (!value) return;
    const event: PositiveEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: value,
      date: dateKey(),
      createdAt: Date.now(),
    };
    await addEvent(event);
    // Gently re-surface it a while later so it lands instead of being forgotten.
    scheduleResurface(value, lang, settings.apiKey);

    if (!settings.apiKey) {
      settleAmalgam("");
      return;
    }

    setPhase("matching");
    try {
      const strengths = await getStrengthStore()
        .then((s) => s.strengths.map(({ id, text: st }) => ({ id, text: st })))
        .catch(() => [] as { id: string; text: string }[]);
      const m = await matchEventToVision(
        settings.apiKey,
        value,
        settings.visionCards,
        lang,
        strengths
      );
      if (m.cardId) {
        const card = settings.visionCards.find((c) => c.id === m.cardId);
        if (card) {
          await updateEvent(event.id, { matchedCardId: m.cardId, matchReason: m.reason });
          setKicker(t("event.thisIsYou"));
          setCardLine(card.text);
          setTint(cardTints[card.tint % cardTints.length]);
          setReason(m.reason);
          setStrengthLine(m.strengthLine);
          setPhase("affirmed");
          return;
        }
      }
      settleAmalgam(m.strengthLine);
    } catch {
      settleAmalgam("");
    }
  }

  const scale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {phase === "input" && (
              <>
                <Text style={styles.title}>{t("event.title")}</Text>
                <Field
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder={t("event.placeholder")}
                  autoFocus
                />
                <View style={{ height: spacing.md }} />
                <PrimaryButton title={t("event.save")} onPress={submit} />
                {onNegative && (
                  <Pressable onPress={goNegative} hitSlop={8} style={styles.negativeLink}>
                    <Text style={styles.negativeTxt}>{t("practice.logNegative")}</Text>
                  </Pressable>
                )}
              </>
            )}

            {phase === "matching" && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>{t("event.matching")}</Text>
              </View>
            )}

            {phase === "affirmed" && (
              <>
                {!!kicker && <Text style={styles.thisIsYou}>{kicker}</Text>}
                <Animated.View style={{ opacity: reveal, transform: [{ scale }] }}>
                  <View style={[styles.card, { backgroundColor: tint.bg }]}>
                    <Text style={[styles.cardText, { color: tint.fg }]}>{cardLine}</Text>
                  </View>
                </Animated.View>
                {!!reason && <Text style={styles.reason}>{reason}</Text>}
                <Animated.View style={{ opacity: feelFade }}>
                  {!!strengthLine && (
                    <Text style={[styles.strengthLine, { color: tint.fg }]}>
                      ✦ {strengthLine}
                    </Text>
                  )}
                  <Text style={styles.feelPrompt}>{t("event.feelPrompt")}</Text>
                </Animated.View>
                <View style={{ height: spacing.md }} />
                <HoldToFeelButton label={t("event.holdToClose")} onDone={close} />
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
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
  title: {
    color: colors.text,
    fontSize: font.heading,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  center: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: font.body, lineHeight: 22, textAlign: "center" },
  thisIsYou: {
    color: colors.accent,
    fontSize: font.label,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  // bg/text colors come per-log from cardTints (a matched vision's own tint,
  // or a random one for the amalgam) — set inline at the render site.
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    fontSize: font.heading,
    fontWeight: "600",
    lineHeight: 28,
    textAlign: "center",
  },
  reason: {
    color: colors.textMuted,
    fontSize: font.body,
    fontStyle: "italic",
    lineHeight: 22,
    marginTop: spacing.md,
    textAlign: "center",
  },
  strengthLine: {
    fontSize: font.body,
    fontWeight: "600",
    lineHeight: 22,
    marginTop: spacing.md,
    textAlign: "center",
  },
  // The one instruction on the screen that matters — styled to be read, not
  // skimmed as fine print like the old faint reassure line was.
  feelPrompt: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: "600",
    lineHeight: 23,
    marginTop: spacing.md,
    textAlign: "center",
  },
  negativeLink: { marginTop: spacing.md, alignItems: "center" },
  negativeTxt: { color: colors.textFaint, fontSize: font.label },
  holdBtn: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  holdFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accentSoft,
  },
  holdTxt: { color: colors.textMuted, fontSize: font.body, fontWeight: "600" },
  holdTxtActive: { color: colors.accent },
});
