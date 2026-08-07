import React, { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { colors, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { dateKey } from "../lib/dates";
import { addEvent, PositiveEvent } from "../lib/events";
import { Field, PrimaryButton } from "./ui";

// Logging is instant, offline, and over the moment it's saved.
//
// It used to make an AI call here to match the moment to a vision (removed
// 2026-08-02), and then still held you on a landing screen: an affirmation
// card, an instruction to find the feeling, and a ~3s press-and-hold to
// close. All of it existed to make the moment land *at log time*.
//
// Removed 2026-08-07 at the user's request: the feeling arrives when he reads
// the day's recap, so charging for it at the moment of noticing only made him
// slower to notice. A single haptic confirms the save; the sheet is gone
// before the thought is. Nothing downstream cared — the recap groups the
// day's moments itself and never read anything this screen produced.
export function LogEventSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);

  // Speech goes straight into the same field typing does, so there is no
  // second screen, no confirm step and nothing to review — say it, and it's
  // written. Whatever was already typed is kept; dictation appends to it.
  const baseText = useRef("");

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (e) => {
    const said = e.results?.[0]?.transcript ?? "";
    if (!said) return;
    const base = baseText.current;
    setText(base ? `${base} ${said}` : said);
  });
  useSpeechRecognitionEvent("error", () => setListening(false));

  async function toggleMic() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    baseText.current = text.trim();
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      // stops on its own when you stop talking — one tap in, none out
      continuous: false,
    });
  }

  function close() {
    if (listening) ExpoSpeechRecognitionModule.stop();
    setText("");
    setListening(false);
    onClose();
  }

  async function submit() {
    if (listening) ExpoSpeechRecognitionModule.stop();
    const value = text.trim();
    if (!value) return;
    const event: PositiveEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: value,
      date: dateKey(),
      createdAt: Date.now(),
    };
    await addEvent(event);
    // The only acknowledgement left: it registered, and you're already free.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>{"Positive sign"}</Text>
            <Field
              value={text}
              onChangeText={setText}
              multiline
              placeholder={listening ? "Listening…" : "What did you notice today? A small synchronicity, good news, a step forward…"}
              autoFocus
            />
            <View style={{ height: spacing.md }} />
            <View style={styles.row}>
              <Pressable
                onPress={toggleMic}
                style={[styles.mic, listening && styles.micOn]}
                accessibilityRole="button"
                accessibilityLabel={"Say it instead"}
              >
                <Text style={[styles.micGlyph, listening && styles.micGlyphOn]}>●</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <PrimaryButton title={"Add"} onPress={submit} />
              </View>
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
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mic: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  micOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  micGlyph: { color: colors.textMuted, fontSize: 20 },
  micGlyphOn: { color: colors.card },
});
