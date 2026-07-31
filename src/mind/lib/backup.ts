import AsyncStorage from "@react-native-async-storage/async-storage";

// A snapshot of everything the MIND module stores. Inside Roof this must be
// scoped: export only mind keys (never Roof's hangtime.* store), and import
// only mind keys (a backup file must never be able to overwrite Roof data).
// The key list mirrors the standalone Slide app, so its backups import cleanly.
const MIND_KEYS = [
  "settings:v2",
  "settings:v1",
  "events:v1",
  "strengths:v1",
  "reframes:v1",
  "visionReflections:v1",
  "visionWhyLastAsked",
  "dailyRecap:v2",
  "weeklyRecap:v1",
  "recapDoneV2",
  "mirrorFeed:v1",
  "mirrorThanks:v1",
  "voicePack:v3",
  "whyQuestions:v1",
  "dissolveRatings:v1",
  "dissolveAskedWeek",
] as const;

const MIND_KEY_SET = new Set<string>(MIND_KEYS);

type BackupFile = {
  app: "slide-tracker";
  exportedAt: string;
  data: Record<string, string>;
};

export async function exportBackup(): Promise<string> {
  const pairs = await AsyncStorage.multiGet([...MIND_KEYS]);
  const data: Record<string, string> = {};
  for (const [k, v] of pairs) {
    if (v != null) data[k] = v;
  }
  const backup: BackupFile = {
    app: "slide-tracker",
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(backup, null, 2);
}

/** Does this device have any real mind data yet? Guards cloud-restore. */
export async function mindLooksEmpty(): Promise<boolean> {
  const pairs = await AsyncStorage.multiGet(["events:v1", "settings:v2"]);
  const events = pairs[0][1];
  const settings = pairs[1][1];
  if (events && events !== "[]") return false;
  if (settings) {
    try {
      const s = JSON.parse(settings);
      if ((s.visionCards?.length ?? 0) > 0 || s.dreamPortrait) return false;
    } catch {}
  }
  return true;
}

// Restores mind keys found in the backup (overwrites matching keys; never
// deletes keys absent from the backup; silently drops any non-mind key so a
// backup file can never touch the rest of Roof). Returns keys restored.
export async function importBackup(json: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("not valid JSON");
  }
  const backup = parsed as Partial<BackupFile>;
  if (!backup || typeof backup !== "object" || !backup.data) {
    throw new Error("not a Slide backup file");
  }
  const entries = Object.entries(backup.data).filter(
    ([k, v]) => typeof v === "string" && MIND_KEY_SET.has(k)
  ) as [string, string][];
  if (entries.length === 0) return 0;
  await AsyncStorage.multiSet(entries);
  return entries.length;
}
