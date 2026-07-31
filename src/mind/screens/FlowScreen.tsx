import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { colors, font, radius, spacing } from "../lib/theme";
import { currentWeekStart } from "../lib/dates";
import { useSettings } from "../lib/SettingsContext";
import { getEvents, PositiveEvent } from "../lib/events";
import { DEFAULT_VISION_ID, defaultVisionText } from "../lib/defaultVision";
import { LogEventSheet } from "../components/LogEventSheet";
import { EditEventSheet } from "../components/EditEventSheet";

// A flat threshold, not a comparison to other days — a day with this many
// signs or more gets a slightly bolder count, nothing more.
const NOTABLE_COUNT = 3;

export default function FlowScreen() {
  const { t, lang, settings } = useSettings();
  const locale = lang === "tr" ? "tr-TR" : "en-US";
  const [events, setEvents] = useState<PositiveEvent[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<PositiveEvent | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const initialized = useRef(false);

  async function load() {
    setEvents(await getEvents());
  }
  useEffect(() => {
    load();
  }, []);

  // Group by date (events already sorted newest-first). Memoized and built
  // via a Map: the old inline groups.find loop was O(n²) and re-ran on every
  // render, which starts to hurt once months of days accumulate.
  const groups = useMemo(() => {
    const byDate = new Map<string, PositiveEvent[]>();
    for (const e of events) {
      const list = byDate.get(e.date);
      if (list) list.push(e);
      else byDate.set(e.date, [e]);
    }
    return [...byDate.entries()].map(([date, items]) => ({ date, items }));
  }, [events]);

  // Everything starts collapsed — the page is just a quiet list of days until
  // you choose to open one.
  useEffect(() => {
    if (initialized.current || groups.length === 0) return;
    initialized.current = true;
    setCollapsed(new Set(groups.map((g) => g.date)));
  }, [groups.length]);

  function toggle(date: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  // Anything that isn't tied to one of the user's own visions still belongs
  // somewhere real — it reads as the permanent "seeing the positive" vision,
  // never a vague "unmatched" state. Covers the default id and any legacy
  // event saved before this existed.
  function cardText(id?: string): string {
    if (id && id !== DEFAULT_VISION_ID) {
      const own = settings.visionCards.find((c) => c.id === id)?.text;
      if (own) return own;
    }
    return defaultVisionText(t);
  }


  function pretty(date: string) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  // The running weekly total makes the sheer volume of noticed signs visible —
  // "115 this week" lands differently than day-by-day counts alone.
  const weekStart = currentWeekStart();
  const weekCount = events.filter((e) => e.date >= weekStart).length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>{t("flow.subtitle")}</Text>
      <Text style={styles.title}>{t("flow.title")}</Text>
      {weekCount > 0 && (
        <Text style={styles.weekTotal}>
          {t("flow.thisWeek")} <Text style={styles.weekTotalNum}>{weekCount}</Text> {t("flow.signsMany")} ✦
        </Text>
      )}

      <Pressable style={styles.logRow} onPress={() => setLogOpen(true)}>
        <Text style={styles.spark}>✦</Text>
        <Text style={styles.logText}>{t("practice.logPositive")}</Text>
        <Text style={styles.plus}>＋</Text>
      </Pressable>

      {events.length === 0 ? (
        <Text style={styles.empty}>{t("flow.empty")}</Text>
      ) : (
        groups.map((g) => {
          const isCollapsed = collapsed.has(g.date);
          // The count is always visible in green; past a flat threshold it
          // gets a little bolder — no comparison to other days, so no day
          // ever reads as a dip.
          const notable = g.items.length >= NOTABLE_COUNT;
          return (
            <View key={g.date} style={styles.group}>
              <Pressable
                style={[styles.groupHeader, !isCollapsed && styles.groupHeaderOpen]}
                onPress={() => toggle(g.date)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupDate}>{pretty(g.date)}</Text>
                  <Text style={[styles.groupCount, notable && styles.groupCountNotable]}>
                    {g.items.length}{" "}
                    {g.items.length === 1 ? t("flow.signsOne") : t("flow.signsMany")}
                  </Text>
                </View>
                <View style={styles.chevWrap}>
                  <Text style={styles.chev}>{isCollapsed ? "▾" : "▴"}</Text>
                </View>
              </Pressable>

              {!isCollapsed && (
                <View style={styles.groupBody}>
                  {g.items.map((e) => (
                    <Pressable key={e.id} style={styles.item} onPress={() => setEditEvent(e)}>
                      <Text style={styles.itemText}>{e.text}</Text>
                      {!!e.matchedCardId && (
                        <Text style={styles.tag}>
                          {t("flow.matched")} {cardText(e.matchedCardId)}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}

      <LogEventSheet
        visible={logOpen}
        onClose={() => {
          setLogOpen(false);
          load();
        }}
      />
      <EditEventSheet
        event={editEvent}
        onClose={() => {
          setEditEvent(null);
          load();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  subtitle: { color: colors.textMuted, fontSize: font.label, marginBottom: 2 },
  title: { color: colors.text, fontSize: font.title, fontWeight: "700" },
  weekTotal: { color: colors.textMuted, fontSize: font.label, marginTop: spacing.xs },
  weekTotalNum: { color: colors.success, fontWeight: "800" },

  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  spark: { color: colors.success, fontSize: font.body },
  logText: { flex: 1, color: colors.textFaint, fontSize: font.body },
  plus: { color: colors.textMuted, fontSize: font.heading },
  empty: { color: colors.textFaint, fontSize: font.body, lineHeight: 22, marginTop: spacing.xl },

  group: { marginTop: spacing.sm },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  groupHeaderOpen: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  groupDate: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  groupCount: { color: colors.success, fontSize: font.caption, fontWeight: "600", marginTop: 2 },
  groupCountNotable: { fontWeight: "800" },
  chevWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  chev: { color: colors.accent, fontSize: font.body, fontWeight: "800" },

  groupBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.accent,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    padding: spacing.md,
  },
  item: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemText: { color: colors.text, fontSize: font.body, lineHeight: 22 },
  tag: { color: colors.accent, fontSize: font.caption, marginTop: spacing.xs },
});
