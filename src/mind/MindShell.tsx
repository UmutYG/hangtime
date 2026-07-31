import React, { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font, spacing } from "./lib/theme";
import { pruneOldEvents } from "./lib/events";
import { ensureNotifications, handleNotificationResponse } from "./lib/notifications";
import { pushMindToCloud, restoreMindIfEmpty } from "./lib/mindCloud";
import { SettingsProvider, useSettings } from "./lib/SettingsContext";
import PracticeScreen from "./screens/PracticeScreen";
import FlowScreen from "./screens/FlowScreen";
import VisionScreen from "./screens/VisionScreen";
import StrengthsScreen from "./screens/StrengthsScreen";
import { RoofBar } from "../components/RoofBar";
import { theme } from "../theme";

// The Mind room — the Slide app living as a Roof module. Same four tabs, same
// inner navigation, its own reminder system; Supabase/Siri/widget surfaces of
// the standalone app were deliberately left behind (Roof has no accounts and
// no phone-surface extras). Cloud safety net is the shared iCloud container.

type Tab = "practice" | "flow" | "vision" | "strengths";

function Shell() {
  const { ready, settings, t, reload } = useSettings();
  const [tab, setTab] = useState<Tab>("practice");
  const insets = useSafeAreaInsets();

  // Boot: if this install's mind is empty and an iCloud snapshot exists
  // (reinstall / new phone), restore it before the user types anything.
  useEffect(() => {
    restoreMindIfEmpty().then((r) => {
      if (r === "restored") reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backgrounding quietly snapshots the mind to iCloud. Best-effort.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") pushMindToCloud();
    });
    return () => sub.remove();
  }, []);

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
        {tab === "vision" && <VisionScreen />}
        {tab === "strengths" && <StrengthsScreen />}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TabButton label={t("tab.practice")} active={tab === "practice"} onPress={() => setTab("practice")} />
        <TabButton label={t("tab.flow")} active={tab === "flow"} onPress={() => setTab("flow")} />
        <TabButton label={t("tab.vision")} active={tab === "vision"} onPress={() => setTab("vision")} />
        <TabButton label={t("tab.strengths")} active={tab === "strengths"} onPress={() => setTab("strengths")} />
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
