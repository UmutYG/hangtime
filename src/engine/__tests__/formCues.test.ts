import { describe, expect, it } from 'vitest';
import { FORM_CUES, formCueFor } from '../formCues';

describe('form cues', () => {
  it('every modality has cues and they are non-empty strings', () => {
    for (const list of Object.values(FORM_CUES)) {
      expect(list.length).toBeGreaterThan(0);
      for (const cue of list) expect(cue.length).toBeGreaterThan(10);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(formCueFor('pull', 7)).toBe(formCueFor('pull', 7));
  });

  it('never phrases a cue as a command ("must"/"should"/"!")', () => {
    for (const list of Object.values(FORM_CUES)) {
      for (const cue of list) {
        expect(cue.toLowerCase()).not.toMatch(/\bmust\b|\bshould\b|!/);
      }
    }
  });

  it('handles negative seeds without throwing (older/negative cycle math)', () => {
    expect(() => formCueFor('run', -3)).not.toThrow();
  });
});
