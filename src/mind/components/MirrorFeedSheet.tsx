import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  FlatList,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, cardTints, font, radius, spacing } from "../lib/theme";
import { useSettings } from "../lib/SettingsContext";
import { PositiveEvent } from "../lib/events";
import { dateKey } from "../lib/dates";
import { generateMirrorFeed, MirrorReel } from "../lib/claude";
import { VisionCard } from "../lib/settings";
import { buildInnerNotes } from "../lib/innerMap";
import { Constellation } from "./Constellation";

const CACHE_KEY = "mirrorFeed:v1";

type FeedItem = MirrorReel | { kind: "end" };

// The daily mirror feed: a FINITE, once-a-day stack of full-screen cards that
// imagine the user's own vision for them — a corner for the days it feels
// like too much effort to picture it yourself. Swiped vertically like reels,
// but with an end: systematic repetition until the vision feels commonplace,
// not an infinite scroll. Real noticed moments live in the recap features,
// not here.
export function MirrorFeedSheet({
  visible,
  events,
  onClose,
}: {
  visible: boolean;
  events: PositiveEvent[];
  onClose: () => void;
}) {
  const { t, lang, settings } = useSettings();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [reels, setReels] = useState<MirrorReel[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const forceRef = useRef(false);
  // A fast open→close→open used to fire a SECOND full generation while the
  // first was still in flight (the discarded run finished after the alive
  // check, so nothing was cached either). One shared in-flight promise per
  // component: a reopen awaits the run already going instead of paying for
  // a duplicate.
  const inFlightRef = useRef<Promise<MirrorReel[]> | null>(null);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const today = dateKey();
    const force = forceRef.current;
    forceRef.current = false;
    (async () => {
      setPhase("loading");
      if (!force) {
        try {
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached.date === today && Array.isArray(cached.reels) && cached.reels.length) {
              if (alive) {
                setReels(cached.reels);
                setPhase("ready");
              }
              return;
            }
          }
        } catch {}
      }

      // Without a key the mirror still works — it just speaks each vision
      // as-is, unadorned.
      if (!settings.apiKey) {
        if (alive) {
          setReels(localFeed(settings.visionCards));
          setPhase("ready");
        }
        return;
      }

      try {
        if (!inFlightRef.current) {
          inFlightRef.current = (async () => {
            // The inner map — reflections, accepted strengths, what tends to
            // weigh on them — quietly seasons the generation without surfacing.
            const notes = await buildInnerNotes().catch(() => []);
            const feed = await generateMirrorFeed(
              settings.apiKey,
              lang,
              settings.visionCards,
              events,
              notes
            );
            // Cache BEFORE any alive check — a close mid-generation should
            // never bill the call and then discard the result.
            await AsyncStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ date: today, reels: feed })
            ).catch(() => {});
            return feed;
          })().finally(() => {
            inFlightRef.current = null;
          });
        }
        const feed = await inFlightRef.current;
        if (!alive) return;
        setReels(feed);
        setPhase("ready");
      } catch (e: any) {
        if (alive) {
          setErrMsg(e?.message ?? String(e));
          setPhase("error");
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, nonce]);

  function regenerate() {
    forceRef.current = true;
    setNonce((n) => n + 1);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {phase === "loading" ? (
        <View style={styles.loadWrap}>
          <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
          <Text style={styles.loadTxt}>{t("mirror.building")}</Text>
        </View>
      ) : phase === "error" ? (
        <View style={styles.loadWrap}>
          <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
          <Text style={styles.loadTxt}>{t("reflect.error")}</Text>
          {!!errMsg && <Text style={styles.errDetail}>[{errMsg}]</Text>}
        </View>
      ) : (
        <Feed
          reels={reels}
          visionCards={settings.visionCards}
          onClose={onClose}
          onRegenerate={regenerate}
        />
      )}
    </Modal>
  );
}

// Keyless fallback: each vision spoken as its own slide, unadorned.
function localFeed(visionCards: VisionCard[]): MirrorReel[] {
  return visionCards.map((c) => ({ kind: "slide", visionId: c.id, text: c.text }));
}

function Feed({
  reels,
  visionCards,
  onClose,
  onRegenerate,
}: {
  reels: MirrorReel[];
  visionCards: VisionCard[];
  onClose: () => void;
  onRegenerate: () => void;
}) {
  const { t } = useSettings();
  const { height, width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const items: FeedItem[] = [...reels, { kind: "end" }];

  const onViewable = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const i = viewableItems[0]?.index;
      if (i != null) setIndex(i);
    }
  ).current;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) =>
          item.kind === "end" ? (
            <EndCard height={height} width={width} onClose={onClose} onRegenerate={onRegenerate} />
          ) : (
            <Reel reel={item} visionCards={visionCards} height={height} width={width} />
          )
        }
        pagingEnabled
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      />
      <Pressable style={styles.close} hitSlop={12} onPress={onClose}>
        <Text style={styles.closeTxt}>✕</Text>
      </Pressable>
      {index < reels.length && (
        <Text style={styles.counter}>
          {index + 1} / {reels.length}
        </Text>
      )}
      {index === 0 && reels.length > 1 && <SwipeHint />}
    </View>
  );
}

// The other story surfaces (recaps) advance on a right-tap, so fingers come
// here trained wrong — a quiet bobbing chevron on the first card teaches the
// vertical gesture without a tutorial. Gone the moment they scroll.
function SwipeHint() {
  const { t } = useSettings();
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 6, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.hintWrap} pointerEvents="none">
      <Text style={styles.hintTxt}>{t("mirror.swipeHint")}</Text>
      <Animated.Text style={[styles.hintChev, { transform: [{ translateY: bob }] }]}>↓</Animated.Text>
    </View>
  );
}

// One full-screen card: a constellation unique to the vision, breathing
// against the same ink the intro opens on.
function Reel({
  reel,
  visionCards,
  height,
  width,
}: {
  reel: MirrorReel;
  visionCards: VisionCard[];
  height: number;
  width: number;
}) {
  const { t } = useSettings();
  const card = reel.visionId ? visionCards.find((c) => c.id === reel.visionId) : undefined;
  const tint = card ? cardTints[card.tint % cardTints.length] : null;

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every card shares one dark register (the intro's ink) — a single
  // consistent night sky. What tells visions apart is the constellation:
  // its layout comes from the vision's own id, its glow from the tint.
  const dotColor = tint ? tint.bg : colors.accentSoft;
  const seed = card?.id ?? `${reel.kind}:${reel.text.slice(0, 24)}`;

  return (
    <View style={{ height, width, backgroundColor: colors.text }}>
      <Constellation seed={seed} color={dotColor} width={width} height={height} />
      <Animated.View style={[styles.reelContent, { opacity: fade }]}>
        <Text style={[styles.kicker, { color: colors.accent }]}>
          {t("mirror.kind." + reel.kind)}
        </Text>
        <Text style={[styles.reelText, { color: colors.bg }]}>{reel.text}</Text>
        {!!card && (
          <Text style={[styles.visionTag, { color: colors.textFaint }]} numberOfLines={2}>
            ✦ {card.text}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

// The feed ends on purpose: the mirror is a practice, not a scroll.
function EndCard({
  height,
  width,
  onClose,
  onRegenerate,
}: {
  height: number;
  width: number;
  onClose: () => void;
  onRegenerate: () => void;
}) {
  const { t } = useSettings();
  return (
    <View style={[styles.endWrap, { height, width }]}>
      <Text style={styles.endTitle}>{t("mirror.end.title")}</Text>
      <Text style={styles.endSub}>{t("mirror.end.sub")}</Text>
      <Pressable style={styles.endBtn} onPress={onClose}>
        <Text style={styles.endBtnTxt}>{t("common.close")}</Text>
      </Pressable>
      <Pressable style={styles.endGhost} onPress={onRegenerate}>
        <Text style={styles.endGhostTxt}>{t("dailyRecap.regenerate")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { position: "absolute", top: spacing.xl * 2, right: spacing.lg, zIndex: 6 },
  closeTxt: { color: colors.textMuted, fontSize: font.heading, fontWeight: "600" },
  counter: {
    position: "absolute",
    top: spacing.xl * 2 + 4,
    left: spacing.lg,
    color: colors.textFaint,
    fontSize: font.caption,
    fontWeight: "600",
    zIndex: 6,
  },

  loadWrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadTxt: { color: colors.textMuted, fontSize: font.body },

  hintWrap: {
    position: "absolute",
    bottom: spacing.xl * 1.4,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5,
  },
  hintTxt: { color: colors.textFaint, fontSize: font.caption, fontWeight: "600" },
  hintChev: { color: colors.accent, fontSize: font.heading, marginTop: 2 },
  errDetail: {
    color: colors.textFaint,
    fontSize: font.caption,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 17,
  },

  reelContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  kicker: {
    fontSize: font.label,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  reelText: { fontSize: font.title, fontWeight: "700", lineHeight: 40 },
  visionTag: { fontSize: font.label, marginTop: spacing.sm },

  endWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  endTitle: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 36,
  },
  endSub: {
    color: colors.textMuted,
    fontSize: font.body,
    lineHeight: 25,
    textAlign: "center",
    marginTop: spacing.md,
  },
  endBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 1.5,
    marginTop: spacing.xl,
  },
  endBtnTxt: { color: colors.onAccent, fontSize: font.body, fontWeight: "700" },
  endGhost: { marginTop: spacing.md, paddingVertical: spacing.sm },
  endGhostTxt: { color: colors.textFaint, fontSize: font.label },
});
