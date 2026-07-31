import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { colors, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { PositiveEvent, updateEvent, deleteEvent } from "../lib/events";
import { matchEventToVision } from "../lib/claude";
import { DEFAULT_VISION_ID, defaultVisionCard } from "../lib/defaultVision";
import { Field, PrimaryButton } from "./ui";

// Tap a logged sign to fix a typo, re-match it to a vision card, or delete it.
export function EditEventSheet({
  event,
  onClose,
}: {
  event: PositiveEvent | null;
  onClose: () => void;
}) {
  const { t, lang, settings } = useSettings();
  const [text, setText] = useState("");
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    setText(event?.text ?? "");
    setMatching(false);
  }, [event]);

  const matchedCard = event
    ? event.matchedCardId === DEFAULT_VISION_ID
      ? defaultVisionCard(lang, t)
      : settings.visionCards.find((c) => c.id === event.matchedCardId)
    : undefined;

  async function save() {
    const value = text.trim();
    if (!event || !value) return;
    await updateEvent(event.id, { text: value });
    onClose();
  }

  async function remove() {
    if (!event) return;
    await deleteEvent(event.id);
    onClose();
  }

  async function rematch() {
    const value = text.trim();
    if (!event || !value || !settings.apiKey || settings.visionCards.length === 0)
      return;
    setMatching(true);
    try {
      // Persist any edit first so the match reflects the latest text.
      await updateEvent(event.id, { text: value });
      const m = await matchEventToVision(
        settings.apiKey,
        value,
        settings.visionCards,
        lang
      );
      await updateEvent(event.id, {
        matchedCardId: m.cardId ?? DEFAULT_VISION_ID,
        matchReason: m.reason,
      });
      onClose();
    } catch {
      setMatching(false);
    }
  }

  const canRematch = !!settings.apiKey && settings.visionCards.length > 0;

  return (
    <Modal
      visible={!!event}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>{t("edit.title")}</Text>
            <Field value={text} onChangeText={setText} multiline autoFocus />

            {matchedCard && (
              <Text style={styles.matched}>
                {t("flow.matched")} {matchedCard.text}
              </Text>
            )}

            <View style={{ height: spacing.md }} />
            <PrimaryButton title={t("edit.save")} onPress={save} />

            <View style={styles.actions}>
              {canRematch &&
                (matching ? (
                  <View style={styles.rematchRow}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.link}>{t("edit.rematching")}</Text>
                  </View>
                ) : (
                  <Pressable onPress={rematch} hitSlop={8}>
                    <Text style={styles.link}>{t("edit.rematch")}</Text>
                  </Pressable>
                ))}
              <View style={{ flex: 1 }} />
              <Pressable onPress={remove} hitSlop={8}>
                <Text style={styles.delete}>{t("edit.delete")}</Text>
              </Pressable>
            </View>
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
  matched: {
    color: colors.accent,
    fontSize: font.caption,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
  },
  rematchRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  link: { color: colors.accent, fontSize: font.label, fontWeight: "600" },
  delete: { color: colors.danger, fontSize: font.label, fontWeight: "600" },
});
