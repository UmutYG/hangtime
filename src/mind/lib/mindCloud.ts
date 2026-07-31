import { Platform } from "react-native";
import { exportBackup, importBackup, mindLooksEmpty } from "./backup";

// iCloud backup for the Mind module — replaces Slide's Supabase whole-snapshot
// mirror with the same iCloud container the rest of Roof uses. No accounts.
//
// Deliberately last-write-wins, not union-merge: the mind data is a snapshot of
// many small AsyncStorage keys owned by proven Slide code we don't rewrite.
// Single-user, effectively single-device — the restore path only ever fires
// into an EMPTY mind (fresh install), so an established device can never have
// its mind overwritten by the cloud.

let CloudStorage: any = null;
try {
  if (Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-cloud-storage");
    CloudStorage = mod.CloudStorage ?? mod.default ?? null;
  }
} catch {
  CloudStorage = null;
}

const FILE = "/roof-mind.json";

let lastPushed: string | null = null;

/** Push the current mind snapshot; skips when nothing changed since last push. */
export async function pushMindToCloud(): Promise<boolean> {
  if (!CloudStorage) return false;
  try {
    if (!(await CloudStorage.isCloudAvailable())) return false;
    const snapshot = await exportBackup();
    if (snapshot === lastPushed) return true;
    await CloudStorage.writeFile(FILE, snapshot);
    lastPushed = snapshot;
    return true;
  } catch {
    return false;
  }
}

/** On boot: if this device's mind is empty and a cloud snapshot exists, restore it. */
export async function restoreMindIfEmpty(): Promise<"restored" | "kept-local" | "none"> {
  if (!CloudStorage) return "none";
  try {
    if (!(await CloudStorage.isCloudAvailable())) return "none";
    if (!(await mindLooksEmpty())) return "kept-local";
    if (!(await CloudStorage.exists(FILE))) return "none";
    const raw = await CloudStorage.readFile(FILE);
    const restored = await importBackup(raw);
    return restored > 0 ? "restored" : "none";
  } catch {
    return "none";
  }
}
