import React from "react";
import { Modal, View, Text, StyleSheet, Pressable, Share } from "react-native";
import { colors, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";

// Full-screen daily quote — the day's lens, held up on the same ink the
// mirror feed and intro speak in. One quote a day; share it or close it.
export function QuoteSheet({
  visible,
  quote,
  onClose,
}: {
  visible: boolean;
  quote: { text: string; source: string };
  onClose: () => void;
}) {
  const { t } = useSettings();

  function share() {
    Share.share({ message: `“${quote.text}” — ${quote.source}` }).catch(() => {});
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Text style={styles.kicker}>{t("quote.kicker")}</Text>
        <Text style={styles.mark}>❝</Text>
        <Text style={styles.text}>{quote.text}</Text>
        <Text style={styles.source}>{quote.source}</Text>

        <View style={styles.footer}>
          <Pressable style={styles.shareBtn} onPress={share}>
            <Text style={styles.shareTxt}>{t("quote.share")}</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.text,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl * 3,
    paddingBottom: spacing.xl * 1.5,
  },
  kicker: {
    color: colors.accent,
    fontSize: font.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  mark: { color: colors.accent, fontSize: 44, marginTop: spacing.lg, lineHeight: 48 },
  text: {
    color: colors.bg,
    fontSize: font.title,
    fontWeight: "700",
    lineHeight: 42,
    marginTop: spacing.sm,
  },
  source: { color: colors.textFaint, fontSize: font.body, fontWeight: "600", marginTop: spacing.lg },

  footer: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  shareBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(250,249,245,0.35)",
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  shareTxt: { color: colors.bg, fontSize: font.body, fontWeight: "700" },
  closeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(250,249,245,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeTxt: { color: colors.bg, fontSize: font.body, fontWeight: "600" },
});
