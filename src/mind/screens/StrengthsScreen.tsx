import React, { useCallback, useEffect, useState } from "react";
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
import { colors, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import {
  Strength,
  getStrengthStore,
  addStrength,
  updateStrength,
  deleteStrength,
} from "../lib/strengths";
import { Card, Field, Label } from "../components/ui";

// "Pozitif Yönlerim" — the inward twin of Flow. Nobody is perfect; everyone
// carries both strengths and weaknesses, and this page exists to make peace
// with that split by pointing the eyes at what's already strong. It is
// deliberately JUST a quiet list (the tap-to-note "where did you see this
// today?" ritual was removed 2026-07-16: it read as one more chore, one more
// "I should add something" — pure cognitive load). Writing a strength down
// once is enough: the list feeds the inner map, so reflections and recaps
// quietly know these sides of the person without being fed daily evidence.
// What you want to GROW belongs in Vision; what you already ARE lives here.
const RULE_KEYS = ["r1", "r2", "r3", "r4"] as const;

export default function StrengthsScreen() {
  const { t } = useSettings();
  const [strengths, setStrengths] = useState<Strength[]>([]);
  const [draft, setDraft] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const reload = useCallback(async () => {
    const store = await getStrengthStore();
    setStrengths(store.strengths);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function submitStrength() {
    const text = draft.trim();
    if (!text) return;
    await addStrength(text);
    setDraft("");
    reload();
  }

  async function saveEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    if (text) await updateStrength(editing.id, text);
    setEditing(null);
    reload();
  }

  async function removeEditing() {
    if (!editing) return;
    await deleteStrength(editing.id);
    setEditing(null);
    reload();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t("strengths.subtitle")}</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t("strengths.title")}</Text>
          <Pressable onPress={() => setInfoOpen(true)} hitSlop={12} style={styles.infoBtn}>
            <Text style={styles.infoIcon}>ⓘ</Text>
          </Pressable>
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          <Label>{t("strengths.listLabel")}</Label>

          <View style={{ marginTop: spacing.sm }}>
            {strengths.length === 0 ? (
              <Text style={styles.empty}>{t("strengths.empty")}</Text>
            ) : (
              strengths.map((s) => (
                <Pressable
                  key={s.id}
                  style={styles.row}
                  onPress={() => setEditing({ id: s.id, text: s.text })}
                >
                  <Text style={styles.rowText}>{s.text}</Text>
                  <Text style={styles.rowEdit}>{t("vision.edit")}</Text>
                </Pressable>
              ))
            )}
          </View>

          <View style={{ height: spacing.md }} />
          <View style={styles.addRow}>
            <Field
              value={draft}
              onChangeText={setDraft}
              placeholder={t("strengths.placeholder")}
              style={{ flex: 1 }}
              onSubmitEditing={submitStrength}
              returnKeyType="done"
            />
            <Pressable onPress={submitStrength} style={styles.addBtn}>
              <Text style={styles.addBtnText}>＋</Text>
            </Pressable>
          </View>
        </Card>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Edit a strength — delete lives here, behind a deliberate step. The
          KAV must live INSIDE the Modal: a Modal is its own native window on
          iOS, so the screen-level KAV outside can't lift it above the
          keyboard. */}
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
              <Text style={styles.sheetTitle}>{t("strengths.editTitle")}</Text>
              <View style={{ height: spacing.md }} />
              <Field
                value={editing?.text ?? ""}
                onChangeText={(v) => setEditing((e) => (e ? { ...e, text: v } : e))}
                autoFocus
                multiline
                placeholder={t("strengths.placeholder")}
                style={{ maxHeight: 140 }}
              />
              <View style={{ height: spacing.lg }} />
              <Pressable style={styles.saveBtn} onPress={saveEdit}>
                <Text style={styles.saveTxt}>{t("common.save")}</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={removeEditing} hitSlop={8}>
                <Text style={styles.deleteTxt}>{t("strengths.delete")}</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)} hitSlop={8}>
                <Text style={styles.cancelTxt}>{t("common.cancel")}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* The philosophy — behind ⓘ, same register as Vision's golden rules */}
      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t("strengths.rulesTitle")}</Text>
            <Text style={styles.sheetIntro}>{t("strengths.rulesIntro")}</Text>
            {RULE_KEYS.map((k, i) => (
              <View key={k} style={styles.ruleRow}>
                <Text style={styles.ruleNum}>{i + 1}</Text>
                <Text style={styles.ruleText}>{t("strengths.rule." + k)}</Text>
              </View>
            ))}
            <Pressable style={styles.saveBtn} onPress={() => setInfoOpen(false)}>
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
  empty: { color: colors.textFaint, fontSize: font.body, lineHeight: 22, marginTop: spacing.sm },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowText: { flex: 1, color: colors.text, fontSize: font.body, fontWeight: "600", lineHeight: 22 },
  rowEdit: { color: colors.accent, fontSize: font.label, fontWeight: "600" },

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

  ruleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  ruleNum: { color: colors.accent, fontSize: font.body, fontWeight: "800", width: 18, textAlign: "center" },
  ruleText: { flex: 1, color: colors.text, fontSize: font.body, lineHeight: 23 },

  saveBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  saveTxt: { color: colors.onAccent, fontSize: font.body, fontWeight: "700" },
  cancelBtn: { marginTop: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  cancelTxt: { color: colors.textFaint, fontSize: font.label },
  deleteTxt: { color: colors.danger, fontSize: font.label, fontWeight: "600" },
});
