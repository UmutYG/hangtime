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
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WorkoutOverlay } from './src/components/WorkoutOverlay';
import { theme } from './src/theme';

type TabName = 'Today' | 'History' | 'Progress';
const TABS: TabName[] = ['Today', 'History', 'Progress'];
const SCREENS: Record<TabName, React.ComponentType> = {
  Today: TodayScreen,
  History: HistoryScreen,
  Progress: ProgressScreen,
};

function TabBar({ active, onChange }: { active: TabName; onChange: (t: TabName) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <BlurView
      intensity={40}
      tint="light"
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 14) }]}
    >
      {TABS.map((t) => (
        <Pressable key={t} onPress={() => onChange(t)} style={styles.tabItem}>
          <View style={[styles.tabDot, { backgroundColor: active === t ? theme.accent : 'transparent' }]} />
          <Text style={[styles.tabLabel, { color: active === t ? theme.accent : theme.textFaint }]}>
            {t}
          </Text>
        </Pressable>
      ))}
    </BlurView>
  );
}

function Tabs() {
  const [active, setActive] = useState<TabName>('Today');
  const Screen = SCREENS[active];
  return (
    <View style={{ flex: 1 }}>
      <Screen />
      <TabBar active={active} onChange={setActive} />
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
