import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/hooks/useStore';
import { WorkoutProvider, useWorkout } from './src/hooks/useWorkout';
import { TodayScreen } from './src/screens/TodayScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { RunsHomeScreen } from './src/screens/RunsHomeScreen';
import { RunTrendsScreen } from './src/screens/RunTrendsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WorkoutOverlay } from './src/components/WorkoutOverlay';
import { theme } from './src/theme';

// Same 3-slot shell in both spaces; the mode decides labels + screens.
type Slot = 0 | 1 | 2;
const MODE_TABS: Record<'pullups' | 'running', { labels: string[]; screens: React.ComponentType[] }> = {
  pullups: {
    labels: ['Today', 'History', 'Progress'],
    screens: [TodayScreen, HistoryScreen, ProgressScreen],
  },
  running: {
    labels: ['Runs', 'History', 'Trends'],
    screens: [RunsHomeScreen, HistoryScreen, RunTrendsScreen],
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

function Tabs() {
  const { store } = useStore();
  const [active, setActive] = useState<Slot>(0);
  const mode = store.appMode;
  const { labels, screens } = MODE_TABS[mode];
  const Screen = screens[active];
  const accent = mode === 'running' ? theme.run : theme.accent;
  return (
    <View style={{ flex: 1 }}>
      <Screen />
      <TabBar labels={labels} active={active} accent={accent} onChange={setActive} />
    </View>
  );
}

function WorkoutHost() {
  const workout = useWorkout();
  const { store, completeSession } = useStore();
  if (!workout.activePlan || !store.profile) return <Tabs />;
  return (
    <WorkoutOverlay
      plan={workout.activePlan}
      profile={store.profile}
      readiness={workout.activeReadiness}
      onCancel={workout.end}
      onSave={completeSession}
    />
  );
}

function Root() {
  const { store, ready } = useStore();
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
      {!store.profile ? (
        <OnboardingScreen />
      ) : (
        <WorkoutProvider>
          <WorkoutHost />
        </WorkoutProvider>
      )}
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
