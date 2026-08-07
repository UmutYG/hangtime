import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MECH_INFO, newSupplementId } from '../engine/supplements';
import type { SupplementItem, SupplementMech } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { MECH_COLOR, theme, type } from '../theme';
import { RoofBar } from '../components/RoofBar';
import { Sheet } from '../components/Sheet';

const MECHS = Object.keys(MECH_INFO) as SupplementMech[];

/** The editable stack — what you take, and the five mechanisms that place it. */
export function SupStackScreen() {
  const { store, saveSupItem, setSupItemActive } = useStore();
  const items = [...(store.supItems ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.order - b.order
  );

  const [editing, setEditing] = useState<SupplementItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      id: newSupplementId(store.supItems ?? []),
      name: '',
      slot: '',
      mech: 'food',
      active: true,
      order: Math.max(0, ...(store.supItems ?? []).map((i) => i.order)) + 1,
    });
  };

  const save = () => {
    if (!editing || !editing.name.trim()) return;
    saveSupItem({ ...editing, name: editing.name.trim(), slot: editing.slot.trim() });
    setEditing(null);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RoofBar />
      <Text style={type.hero}>Stack</Text>

      <View style={styles.card}>
        <Text style={[type.kickerDim, { color: theme.supp }]}>YOUR STACK</Text>
        {items.map((it) => (
          <Pressable
            key={it.id}
            style={styles.row}
            onPress={() => {
              setIsNew(false);
              setEditing({ ...it });
            }}
          >
            <View style={[styles.mechDot, { backgroundColor: MECH_COLOR[it.mech] }]} />
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, !it.active && styles.rowArchived]}>
                {it.name}
                {!it.active ? '  · archived' : ''}
              </Text>
              <Text style={styles.rowSlot}>
                {it.slot || MECH_INFO[it.mech].tag}
                {it.remindAt ? `  ·  reminds ${it.remindAt}` : ''}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        ))}
        <Pressable onPress={startNew} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add an item</Text>
        </Pressable>
      </View>

      <Text style={styles.footNote}>
        Reasoning tool, not medical advice. Built from product specs + the Synevo panel of
        21.05.2026.
      </Text>

      {editing ? (
        <Sheet
          visible
          onClose={() => setEditing(null)}
          title={isNew ? 'New item' : editing.name || 'Edit item'}
          subtitle={isNew ? 'What are you taking, and where does it sit in the day?' : undefined}
        >
          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput
            value={editing.name}
            onChangeText={(name) => setEditing({ ...editing, name })}
            placeholder="e.g. Probiotic"
            placeholderTextColor={theme.textFaint}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>WHEN · HOW</Text>
          <TextInput
            value={editing.slot}
            onChangeText={(slot) => setEditing({ ...editing, slot })}
            placeholder="e.g. Dinner · with food"
            placeholderTextColor={theme.textFaint}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>REMIND ME AT</Text>
          <TextInput
            value={editing.remindAt ?? ''}
            onChangeText={(v) =>
              setEditing({ ...editing, remindAt: v.trim() === '' ? undefined : v.trim() })
            }
            placeholder="07:30 — leave empty for no reminder"
            placeholderTextColor={theme.textFaint}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            style={styles.input}
          />
          <Text style={styles.mechHint}>
            Items sharing a time are reminded together, once. Anything already taken or skipped
            drops out of the day's reminders.
          </Text>

          <Text style={styles.fieldLabel}>MECHANISM</Text>
          <View style={styles.mechChips}>
            {MECHS.map((m) => {
              const on = editing.mech === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setEditing({ ...editing, mech: m })}
                  style={[
                    styles.mechChip,
                    on && { backgroundColor: MECH_COLOR[m], borderColor: MECH_COLOR[m] },
                  ]}
                >
                  <Text style={[styles.mechChipText, on && styles.mechChipTextOn]}>
                    {MECH_INFO[m].tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.mechHint}>{MECH_INFO[editing.mech].blurb}</Text>
          <Text style={styles.fieldLabel}>WHY HERE (OPTIONAL)</Text>
          <TextInput
            value={editing.why ?? ''}
            onChangeText={(why) => setEditing({ ...editing, why: why || undefined })}
            placeholder="Why this spot in the day"
            placeholderTextColor={theme.textFaint}
            multiline
            style={[styles.input, styles.inputMulti]}
          />
          <Text style={styles.fieldLabel}>WHAT TO NOTICE (OPTIONAL)</Text>
          <TextInput
            value={editing.notice ?? ''}
            onChangeText={(notice) => setEditing({ ...editing, notice: notice || undefined })}
            placeholder="The signal or number that judges it"
            placeholderTextColor={theme.textFaint}
            multiline
            style={[styles.input, styles.inputMulti]}
          />
          <Pressable
            onPress={save}
            style={[styles.saveBtn, !editing.name.trim() && { opacity: 0.4 }]}
          >
            <Text style={styles.saveBtnText}>{isNew ? 'Add to stack' : 'Save'}</Text>
          </Pressable>
          {!isNew ? (
            <Pressable
              onPress={() => {
                setSupItemActive(editing.id, !editing.active);
                setEditing(null);
              }}
              style={styles.archiveBtn}
            >
              <Text style={styles.archiveText}>
                {editing.active ? 'Archive — history stays, item leaves the daily list' : 'Restore to the daily list'}
              </Text>
            </Pressable>
          ) : null}
        </Sheet>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 12, paddingBottom: 120 },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 16,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  mechDot: { width: 9, height: 9, borderRadius: 4.5 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontSize: 14.5, fontWeight: '600', color: theme.text },
  rowArchived: { color: theme.textFaint, fontWeight: '500' },
  rowSlot: { fontSize: 11.5, color: theme.textFaint },
  chev: { color: theme.textFaint, fontSize: 17, opacity: 0.6 },
  addBtn: { paddingVertical: 13, alignItems: 'center' },
  addBtnText: { color: theme.supp, fontSize: 13.5, fontWeight: '700' },
  footNote: {
    color: theme.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: theme.textFaint,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },
  mechChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  mechChip: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  mechChipText: { fontSize: 11, fontWeight: '700', color: theme.textDim, textTransform: 'uppercase', letterSpacing: 0.4 },
  mechChipTextOn: { color: '#FFFFFF' },
  mechHint: { fontSize: 12, lineHeight: 17.5, color: theme.textFaint, marginTop: 8 },
  saveBtn: {
    marginTop: 22,
    backgroundColor: theme.dark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: theme.onDark, fontSize: 14.5, fontWeight: '700' },
  archiveBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 6 },
  archiveText: { color: theme.textFaint, fontSize: 12.5, textAlign: 'center' },
});
