import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { colors, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { Card, Label, Field, PrimaryButton } from "../components/ui";

// Mind settings — what belongs to this room only. Backup is not here: Roof
// keeps one central snapshot covering every room (Roof → ⚙), so this module
// never has its own cloud story to get out of step with.

export default function SettingsScreen() {
  const { t, settings, update } = useSettings();
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);

  const tr = settings.language === "tr";

  useEffect(() => {
    setApiKey(settings.apiKey);
  }, [settings.apiKey]);

  async function saveKey() {
    await update({ apiKey: apiKey.trim() });
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1800);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("settings.title")}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Label>{t("settings.language")}</Label>
        <Text style={styles.info}>{t("settings.languageHint")}</Text>
        <View style={{ height: spacing.md }} />
        <View style={styles.langRow}>
          <Pressable
            style={[styles.langBtn, settings.language === "en" && styles.langBtnActive]}
            onPress={() => update({ language: "en" })}
          >
            <Text style={[styles.langTxt, settings.language === "en" && styles.langTxtActive]}>
              English
            </Text>
          </Pressable>
          <Pressable
            style={[styles.langBtn, settings.language === "tr" && styles.langBtnActive]}
            onPress={() => update({ language: "tr" })}
          >
            <Text style={[styles.langTxt, settings.language === "tr" && styles.langTxtActive]}>
              Türkçe
            </Text>
          </Pressable>
        </View>
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Label>{t("settings.apiKey")}</Label>
        <Text style={styles.info}>{t("settings.apiKeyHint")}</Text>
        <View style={{ height: spacing.sm }} />
        <Field
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={t("settings.apiKeyPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <View style={{ height: spacing.md }} />
        <PrimaryButton
          title={keySaved ? t("settings.apiKeySaved") : t("settings.apiKeySave")}
          onPress={saveKey}
        />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Label>{tr ? "Yedekleme" : "Backup"}</Label>
        <Text style={styles.info}>
          {tr
            ? "Burada değil: tek bir yedek var ve bu alan da onun içinde. Ana ekran → ⚙ → hesabına giriş yap."
            : "Not here: there's one backup covering every room, this one included. Home → ⚙ → sign in to your account."}
        </Text>
      </Card>

      {settings.archivedVisions.length > 0 && (
        <Card style={{ marginTop: spacing.md }}>
          <Label>{t("settings.archive")}</Label>
          <Text style={styles.info}>{t("settings.archiveHint")}</Text>
          <View style={{ height: spacing.sm }} />
          {settings.archivedVisions.map((c) => (
            <View key={c.id} style={styles.archiveRow}>
              <Text style={styles.archiveText}>{c.text}</Text>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  update({
                    archivedVisions: settings.archivedVisions.filter((x) => x.id !== c.id),
                    visionCards: [...settings.visionCards, c],
                  })
                }
                disabled={settings.visionCards.length >= 10}
              >
                <Text
                  style={[
                    styles.archiveRestore,
                    settings.visionCards.length >= 10 && styles.archiveRestoreOff,
                  ]}
                >
                  {t("settings.archiveRestore")}
                </Text>
              </Pressable>
            </View>
          ))}
          {settings.visionCards.length >= 10 && (
            <Text style={styles.archiveFull}>{t("settings.archiveFull")}</Text>
          )}
        </Card>
      )}

      <Text style={styles.about}>{t("settings.about")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { color: colors.text, fontSize: font.title, fontWeight: "700" },
  info: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  langRow: { flexDirection: "row", gap: spacing.sm },
  langBtn: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  langBtnActive: { backgroundColor: colors.text, borderColor: colors.text },
  langTxt: { color: colors.textMuted, fontSize: font.body, fontWeight: "600" },
  langTxtActive: { color: colors.bg },
  about: {
    color: colors.textFaint,
    fontSize: font.caption,
    lineHeight: 18,
    marginTop: spacing.xl,
    textAlign: "center",
  },
  archiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  archiveText: { flex: 1, color: colors.textMuted, fontSize: font.label, lineHeight: 19 },
  archiveRestore: { color: colors.accent, fontSize: font.label, fontWeight: "600" },
  archiveRestoreOff: { color: colors.textFaint },
  archiveFull: { color: colors.textFaint, fontSize: font.caption, marginTop: spacing.sm, fontStyle: "italic" },
  cloudMsg: {
    color: colors.accent,
    fontSize: font.caption + 1,
    lineHeight: 18,
    marginTop: spacing.md,
    textAlign: "center",
  },
});
