import React from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/hooks/useStore';
import { TodayScreen } from './src/screens/TodayScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { ProgramScreen } from './src/screens/ProgramScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { theme } from './src/theme';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.bg,
    card: theme.card,
    border: theme.border,
    primary: theme.accent,
    text: theme.text,
  },
};

const ICONS: Record<string, string> = { Today: '●', Progress: '▲', Program: '≡' };

function Tabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: 66 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 24, lineHeight: 28 }}>{ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Program" component={ProgramScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { store, ready } = useStore();
  const insets = useSafeAreaInsets();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  // one place handles the notch for every screen; the tab bar handles the bottom
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top }}>
      {!store.profile ? (
        <OnboardingScreen />
      ) : (
        <NavigationContainer theme={navTheme}>
          <Tabs />
        </NavigationContainer>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="light" />
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
