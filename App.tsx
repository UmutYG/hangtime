import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/hooks/useStore';
import { WorkoutProvider, useWorkout } from './src/hooks/useWorkout';
import { NavCtx, TabCtx, parentOf, RoofView } from './src/hooks/useNav';
import { RoofHomeScreen } from './src/screens/RoofHomeScreen';
import { BodyAreaScreen } from './src/screens/BodyAreaScreen';
import { MindShell } from './src/mind/MindShell';
import { TodayScreen } from './src/screens/TodayScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { RunsHomeScreen } from './src/screens/RunsHomeScreen';
import { RunTrendsScreen } from './src/screens/RunTrendsScreen';
import { PushTodayScreen } from './src/screens/PushTodayScreen';
import { PushProgressScreen } from './src/screens/PushProgressScreen';
import { SupTodayScreen } from './src/screens/SupTodayScreen';
import { SupBodyScreen } from './src/screens/SupBodyScreen';
import { SupStackScreen } from './src/screens/SupStackScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WorkoutOverlay } from './src/components/WorkoutOverlay';
import { RoofBar } from './src/components/RoofBar';
import { AppMode, modeAccent, modeIdentity, theme } from './src/theme';

// Same 3-slot shell in every tabbed space; the space decides labels + screens.
// Mind is not here — it renders its own four-tab shell (MindShell).
type Slot = 0 | 1 | 2;
type TabbedMode = Exclude<AppMode, 'mind'>;
const MODE_TABS: Record<TabbedMode, { labels: string[]; screens: React.ComponentType[] }> = {
  pullups: {
    labels: ['Today', 'History', 'Progress'],
    screens: [TodayScreen, HistoryScreen, ProgressScreen],
  },
  pushups: {
    labels: ['Today', 'History', 'Progress'],
    screens: [PushTodayScreen, HistoryScreen, PushProgressScreen],
  },
  running: {
    labels: ['Runs', 'History', 'Trends'],
    screens: [RunsHomeScreen, HistoryScreen, RunTrendsScreen],
  },
  supplements: {
    labels: ['Today', 'Body', 'Stack'],
    screens: [SupTodayScreen, SupBodyScreen, SupStackScreen],
  },
};

function TabBar({
  labels,
  active,
  accent,
  onChange,
}: {
  labels: string[];
  active: Slot;
  accent: string;
  onChange: (t: Slot) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <BlurView
      intensity={40}
      tint="light"
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 14) }]}
    >
      {labels.map((label, i) => (
        <Pressable key={label} onPress={() => onChange(i as Slot)} style={styles.tabItem}>
          <View style={[styles.tabDot, { backgroundColor: active === i ? accent : 'transparent' }]} />
          <Text style={[styles.tabLabel, { color: active === i ? accent : theme.textFaint }]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </BlurView>
  );
}

function SpaceTabs({ space }: { space: TabbedMode }) {
  const { store } = useStore();
  const [active, setActive] = useState<Slot>(0);
  // the pull-up space owns its own setup — the rest of the roof never waits on it
  if (space === 'pullups' && !store.profile) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: theme.pad, paddingTop: theme.pad }}>
          <RoofBar />
        </View>
        <OnboardingScreen />
      </View>
    );
  }
  const { labels, screens } = MODE_TABS[space];
  const Screen = screens[active];
  return (
    <TabCtx.Provider value={{ active, setActive: (i: number) => setActive(i as Slot) }}>
      <View style={{ flex: 1, backgroundColor: modeIdentity(space).wash }}>
        <Screen />
        <TabBar labels={labels} active={active} accent={modeAccent(space)} onChange={setActive} />
      </View>
    </TabCtx.Provider>
  );
}

function Shell() {
  const { store } = useStore();
  const workout = useWorkout();
  const { completeSession, completePushSession } = useStore();
  const [view, setView] = useState<RoofView>('home');
  const { setAppMode } = useStore();

  const go = useCallback(
    (v: RoofView) => {
      setView(v);
      if (v !== 'home' && v !== 'body') setAppMode(v); // accents/history filters read this
    },
    [setAppMode]
  );
  const goUp = useCallback(() => setView((v) => parentOf(v)), []);
  const goHome = useCallback(() => setView('home'), []);

  // a live workout owns the whole screen, wherever it was started from
  if (workout.activePlan && store.profile) {
    const isPush = workout.activePlan.dayKind.startsWith('push');
    return (
      <WorkoutOverlay
        plan={workout.activePlan}
        profile={store.profile}
        readiness={workout.activeReadiness}
        accent={isPush ? theme.push : theme.accent}
        seed={workout.seed}
        onCancel={workout.end}
        onSave={isPush ? completePushSession : completeSession}
      />
    );
  }

  return (
    <NavCtx.Provider value={{ view, go, goUp, goHome }}>
      {view === 'home' ? (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <RoofHomeScreen />
        </View>
      ) : view === 'body' ? (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <BodyAreaScreen />
        </View>
      ) : view === 'mind' ? (
        <MindShell />
      ) : (
        // key remounts the shell per space so the tab slot resets to the first tab
        <SpaceTabs key={view} space={view} />
      )}
    </NavCtx.Provider>
  );
}

function Root() {
  const { ready } = useStore();
  const insets = useSafeAreaInsets();
  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.outerBg, paddingTop: insets.top }}>
      <WorkoutProvider>
        <Shell />
      </WorkoutProvider>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    overflow: 'hidden',
  },
  tabItem: { alignItems: 'center', width: 80, gap: 5 },
  tabDot: { width: 5, height: 5, borderRadius: 2.5 },
  tabLabel: { fontSize: 12, fontWeight: '600' },
});
