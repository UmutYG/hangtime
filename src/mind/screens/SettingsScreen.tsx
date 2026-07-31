import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { colors, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { Card, Label, Field, GhostButton, PrimaryButton } from "../components/ui";
import { pushMindToCloud } from "../lib/mindCloud";
import { importBackup } from "../lib/backup";

// Mind settings — the standalone Slide app's screen minus its Supabase/Apple
// sign-in world: inside Roof the safety net is the shared iCloud container,
// no accounts. A one-time paste-import brings data over from standalone Slide.

export default function SettingsScreen() {
  const { t, settings, update, reload } = useSettings();
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);

  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const tr = settings.language === "tr";

  useEffect(() => {
    setApiKey(settings.apiKey);
  }, [settings.apiKey]);

  async function doBackup() {
    setCloudBusy(true);
    setCloudMsg(null);
    const ok = await pushMindToCloud();
    setCloudMsg(
      ok
        ? tr
          ? "iCloud'a yedeklendi."
          : "Backed up to iCloud."
        : tr
          ? "iCloud şu an erişilebilir değil."
          : "iCloud isn't reachable right now."
    );
    setCloudBusy(false);
  }

  async function doImport() {
    setImportMsg(null);
    try {
      const n = await importBackup(importText.trim());
      if (n === 0) {
        setImportMsg(tr ? "Dosyada içe aktarılacak bir şey yok." : "Nothing to import in that file.");
        return;
      }
      await reload();
      setImportText("");
      setImportOpen(false);
      setCloudMsg(tr ? "Slide verilerin içe aktarıldı." : "Your Slide data was imported.");
      void pushMindToCloud();
    } catch {
      setImportMsg(tr ? "Bu bir Slide yedeği gibi görünmüyor." : "That doesn't look like a Slide backup.");
    }
  }

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
        <Label>iCloud</Label>
        <Text style={styles.info}>
          {tr
            ? "Zihin alanın Roof'un iCloud kutusuna yedeklenir — hesap yok, sunucu yok. Uygulama arka plana her geçtiğinde sessizce yedeklenir."
            : "The mind space backs up to Roof's iCloud container — no accounts, no server. It snapshots quietly every time the app goes to the background."}
        </Text>
        <View style={{ height: spacing.md }} />
        <PrimaryButton
          title={cloudBusy ? (tr ? "Yedekleniyor…" : "Backing up…") : tr ? "Şimdi yedekle" : "Back up now"}
          onPress={doBackup}
          disabled={cloudBusy}
        />
        <View style={{ height: spacing.sm }} />
        <GhostButton
          title={tr ? "Slide yedeğinden içe aktar" : "Import from a Slide backup"}
          onPress={() => setImportOpen(!importOpen)}
        />
        {importOpen && (
          <>
            <View style={{ height: spacing.sm }} />
            <Field
              value={importText}
              onChangeText={setImportText}
              placeholder={tr ? "Slide yedek JSON'unu buraya yapıştır" : "Paste the Slide backup JSON here"}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              style={{ minHeight: 90, textAlignVertical: "top" }}
            />
            <View style={{ height: spacing.sm }} />
            <PrimaryButton title={tr ? "İçe aktar" : "Import"} onPress={doImport} />
            {importMsg && <Text style={styles.cloudMsg}>{importMsg}</Text>}
          </>
        )}
        {cloudMsg && <Text style={styles.cloudMsg}>{cloudMsg}</Text>}
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
