import { describe, expect, it } from 'vitest';
import { detectShape } from '../../lib/roofBackup';

// applySnapshot itself touches AsyncStorage, so the pure part worth pinning is
// shape detection — it is what stands between "your Slide history came home"
// and "a stray file silently overwrote the roof".

describe('detectShape', () => {
  it('recognises a Roof snapshot', () => {
    expect(detectShape({ app: 'roof', v: 1, exportedAt: '', store: null, mind: {} })).toBe('roof');
  });

  it('recognises a Slide export, which is what the old account holds', () => {
    expect(
      detectShape({ app: 'slide-tracker', exportedAt: '2026-07-01', data: { 'events:v1': '[]' } })
    ).toBe('slide-legacy');
  });

  it('treats a future Roof version as unknown rather than guessing', () => {
    expect(detectShape({ app: 'roof', v: 2, mind: {} })).toBe('unknown');
  });

  it('rejects anything else', () => {
    expect(detectShape(null)).toBe('unknown');
    expect(detectShape('a string')).toBe('unknown');
    expect(detectShape({})).toBe('unknown');
    expect(detectShape({ app: 'someone-elses-app' })).toBe('unknown');
  });

  it('accepts a legacy file even without the app marker, since data is the tell', () => {
    expect(detectShape({ data: { 'settings:v2': '{}' } })).toBe('slide-legacy');
  });

  it('reads a Roof snapshot as Roof even though it mirrors mind under `data` for Slide', () => {
    const dual = {
      app: 'roof',
      v: 1,
      exportedAt: '',
      store: null,
      mind: { 'events:v1': '[]' },
      data: { 'events:v1': '[]' },
    };
    expect(detectShape(dual)).toBe('roof');
  });
});
