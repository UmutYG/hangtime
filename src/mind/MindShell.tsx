import React, { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font, spacing } from "./lib/theme";
import { pruneOldEvents } from "./lib/events";
import { ensureNotifications, handleNotificationResponse } from "./lib/notifications";
import { SettingsProvider, useSettings } from "./lib/SettingsContext";
import PracticeScreen from "./screens/PracticeScreen";
import FlowScreen from "./screens/FlowScreen";
import { RoofBar } from "../components/RoofBar";
import { theme } from "../theme";

// The Mind room: notice a good thing, and look back at what you noticed.
//
// It arrived from the standalone Slide app with four tabs — a vision board and
// a strengths list alongside these two. Both were surfaces you had to go and
// re-read to get anything from them, which is the opposite of what this room
// is for, so they were removed 2026-08-07. What's left is the noticing and the
// record of it.

type Tab = "practice" | "flow";

function Shell() {
  const { ready, settings, t, reload } = useSettings();
  const [tab, setTab] = useState<Tab>("practice");
  const insets = useSafeAreaInsets();

  // Backup lives one level up: Roof's central snapshot covers this module's
  // storage along with everything else (src/lib/roofBackup.ts). A restore
  // writes those keys underneath us, so re-read settings when we come back.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    return () => sub.remove();
  }, [reload]);

  useEffect(() => {
    if (!ready) return;
    ensureNotifications(settings.language, settings.apiKey);
  }, [ready, settings.language, settings.apiKey]);

  // Once per cold start: drop events older than a year (safety valve that
  // keeps the hot-path JSON parse bounded).
  useEffect(() => {
    pruneOldEvents();
  }, []);

  // Re-run on every foreground: the midday reminder is personalized to what
  // the user already noticed today, so it stays fresh as the day's log grows.
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") ensureNotifications(settings.language, settings.apiKey);
    });
    return () => sub.remove();
  }, [ready, settings.language, settings.apiKey]);

  // Handle replies to "jot a positive sign" notifications (even from the lock
  // screen, without opening the app), and route reflection nudges to Flow.
  useEffect(() => {
    const route = (r: Notifications.NotificationResponse) => {
      handleNotificationResponse(r);
      const data = r.notification.request.content.data as { screen?: string };
      if (data?.screen === "flow") setTab("flow");
    };
    const sub = Notifications.addNotificationResponseReceivedListener(route);
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) route(r);
    });
    return () => sub.remove();
  }, []);

  if (!ready) return <View style={styles.safe} />;

  return (
    <View style={styles.safe}>
      <View style={styles.roofRow}>
        <RoofBar />
      </View>
      <View style={styles.screen}>
        {tab === "practice" && <PracticeScreen />}
        {tab === "flow" && <FlowScreen />}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TabButton label="Practice" active={tab === "practice"} onPress={() => setTab("practice")} />
        <TabButton label="Flow" active={tab === "flow"} onPress={() => setTab("flow")} />
      </View>
    </View>
  );
}

export function MindShell() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.tabDot, active && styles.tabDotActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  roofRow: { paddingHorizontal: theme.pad, paddingTop: theme.pad, paddingBottom: 4 },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: spacing.xs },
  tabText: { color: colors.textFaint, fontSize: font.label, fontWeight: "600" },
  tabTextActive: { color: colors.text },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: "transparent",
  },
  tabDotActive: { backgroundColor: colors.accent },
});
