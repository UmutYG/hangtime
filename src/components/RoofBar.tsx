import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { parentOf, useNav } from '../hooks/useNav';
import { AppMode, BRAND, modeIdentity, theme } from '../theme';
import { ModeMark } from './ModeMark';

/** The way out of a room — always one level up, so the nesting stays legible:
 *  training space → Body → Roof. */
export function RoofBar() {
  const { view, goUp } = useNav();
  const up = parentOf(view);
  const upLabel = up === 'body' ? 'Body' : BRAND;
  const isSpace = view !== 'home' && view !== 'body';
  const id = isSpace ? modeIdentity(view as AppMode) : null;
  return (
    <View style={styles.row}>
      <Pressable onPress={goUp} style={styles.homeBtn} hitSlop={8}>
        {up === 'home' ? (
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3.5 11.5 L12 4 L20.5 11.5 M6 10 V20 H18 V10"
              stroke={theme.textDim}
              strokeWidth={2.1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : (
          <Text style={styles.chevron}>‹</Text>
        )}
        <Text style={styles.homeText}>{upLabel}</Text>
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
    gap: 6,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chevron: { color: theme.textDim, fontSize: 15, fontWeight: '700', marginTop: -1 },
  homeText: { fontSize: 12.5, fontWeight: '700', color: theme.textDim, letterSpacing: 0.2 },
  spaceChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spaceText: { fontSize: 12.5, fontWeight: '600' },
});
