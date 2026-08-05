import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { parentOf, useNav } from '../hooks/useNav';
import { AppMode, modeIdentity, theme } from '../theme';
import { ModeMark } from './ModeMark';

/**
 * The way out of a room — always one level up, so the nesting stays legible:
 * training space → Body → home.
 *
 * It deliberately never says the app's name. You know which app you opened;
 * repeating it on every screen is branding, and this isn't a product with
 * customers to remind. The control names its DESTINATION when that
 * destination is a place ("‹ Body"), and shows a bare house when it isn't —
 * the one label on this bar that carries information is the room you're
 * standing in, on the right.
 */
export function RoofBar() {
  const { view, goUp } = useNav();
  const up = parentOf(view);
  const isSpace = view !== 'home' && view !== 'body';
  const id = isSpace ? modeIdentity(view as AppMode) : null;
  const toHome = up === 'home';
  return (
    <View style={styles.row}>
      <Pressable
        onPress={goUp}
        style={[styles.homeBtn, toHome && styles.homeBtnIconOnly]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={toHome ? 'Home' : 'Back to Body'}
      >
        {toHome ? (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3.5 11.5 L12 4 L20.5 11.5 M6 10 V20 H18 V10"
              stroke={theme.textDim}
              strokeWidth={2.1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : (
          <>
            <Text style={styles.chevron}>‹</Text>
            <Text style={styles.homeText}>Body</Text>
          </>
        )}
      </Pressable>
      {id && isSpace ? (
        <View style={styles.spaceChip}>
          <ModeMark mode={view as AppMode} size={13} color={id.accent} />
          <Text style={[styles.spaceText, { color: id.accent }]}>{id.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  // a glyph on its own wants to be round, not a stretched pill
  homeBtnIconOnly: { paddingHorizontal: 9, paddingVertical: 9 },
  chevron: { color: theme.textDim, fontSize: 15, fontWeight: '700', marginTop: -1 },
  homeText: { fontSize: 12.5, fontWeight: '700', color: theme.textDim, letterSpacing: 0.2 },
  spaceChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spaceText: { fontSize: 12.5, fontWeight: '600' },
});
