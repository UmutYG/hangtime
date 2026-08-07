import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors, font, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { Card, Label, Field, PrimaryButton } from "../components/ui";

// Mind settings — what belongs to this room only. Backup is not here: Roof
// keeps one central snapshot covering every room (Home → ⚙), so this module
// never has its own cloud story to get out of step with.
//
// The language switch is gone: the app is English. So is the vision archive,
// along with the vision board it restored cards to.

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);

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
      <Text style={styles.title}>Settings</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Label>Claude API key</Label>
        <Text style={styles.info}>
          Powers the daily and weekly recaps, and the lines your reminders are written in. Get one
          at console.anthropic.com. Stored only on your phone.
        </Text>
        <View style={{ height: spacing.sm }} />
        <Field
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-ant-…"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <View style={{ height: spacing.md }} />
        <PrimaryButton title={keySaved ? "Saved ✓" : "Save key"} onPress={saveKey} />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Label>Backup</Label>
        <Text style={styles.info}>
          Not here: there's one backup covering every room, this one included. Home → ⚙.
        </Text>
      </Card>

      <Text style={styles.about}>All data stays on your phone only.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { color: colors.text, fontSize: font.title, fontWeight: "700" },
  info: { color: colors.textMuted, fontSize: font.body, lineHeight: 22 },
  about: {
    color: colors.textFaint,
    fontSize: font.caption,
    lineHeight: 18,
    marginTop: spacing.xl,
    textAlign: "center",
  },
});
