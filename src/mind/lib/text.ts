// AI-generated lines occasionally come back without terminal punctuation —
// the model treats "under N characters" as license to just stop. Rather than
// rely on the prompt alone, every generated pool is normalized before it's
// cached, so a hanging line never reaches a notification.
export function ensureTerminalPunctuation(line: string): string {
  const trimmed = line.trim();
  if (/[.!?…]["')\]]?$/.test(trimmed)) return trimmed;
  return trimmed + ".";
}

export function normalizeLines(lines: string[]): string[] {
  return lines.map(ensureTerminalPunctuation);
}
