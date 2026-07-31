import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase, supabaseConfigured } from './supabase';
import { Store } from '../engine/types';
import { applySnapshot, buildSnapshot, RestoreResult } from './roofBackup';

// The account backup. One row per user holds the whole roof as a single
// snapshot — the same table the standalone Slide app has been writing to, so
// signing in here reaches the data that was stranded behind that account.
const TABLE = 'user_backups';

export type CloudUser = { id: string; email: string | null };

/** Pushing before we've read the remote row could overwrite a backup we never
 *  saw — notably the legacy Slide snapshot. Cleared only by a successful pull. */
let pulledThisSession = false;

export async function appleSignInAvailable(): Promise<boolean> {
  if (!supabaseConfigured) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<CloudUser> {
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!cred.identityToken) throw new Error('No Apple identity token');
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: cred.identityToken,
  });
  if (error) throw error;
  const u = data.user;
  return { id: u!.id, email: u!.email ?? cred.email ?? null };
}

export async function signOut(): Promise<void> {
  pulledThisSession = false;
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<CloudUser | null> {
  if (!supabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

export async function remoteUpdatedAt(): Promise<string | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data } = await supabase
    .from(TABLE)
    .select('updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  return (data?.updated_at as string) ?? null;
}

/**
 * Pull the account snapshot and apply it. Returns null when the account has no
 * backup yet. Restoring merges rather than replaces, so this is safe to run on
 * a device that already has data.
 */
export async function pullBackup(
  localStore: Store
): Promise<(RestoreResult & { updatedAt: string }) | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  pulledThisSession = true; // even an empty row means we've seen the remote state
  if (!data) return null;
  const result = await applySnapshot(data.data as string, localStore);
  return { ...result, updatedAt: data.updated_at as string };
}

/** Upload the whole roof. Refuses until this session has read the remote row. */
export async function pushBackup(store: Store): Promise<string> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not signed in');
  if (!pulledThisSession) {
    throw new Error('Refusing to overwrite a backup this device has not read yet');
  }
  const snapshot = await buildSnapshot(store);
  const updated_at = new Date().toISOString();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: user.id, data: JSON.stringify(snapshot), updated_at });
  if (error) throw error;
  return updated_at;
}

export interface SignInOutcome {
  user: CloudUser;
  /** what the account held: a Roof backup, the old Slide one, or nothing yet */
  restored: RestoreResult | null;
  /** the merged store to adopt locally, when the snapshot carried one */
  store: Store | null;
}

/**
 * Sign in, then reconcile: always read the account first (so nothing is
 * overwritten unseen), apply whatever was there, and hand the result back for
 * the caller to persist. A legacy Slide snapshot lands as mind data and is
 * re-uploaded in the new format on the next push — the migration is just this.
 */
export async function signInAndReconcile(localStore: Store): Promise<SignInOutcome> {
  const user = await signInWithApple();
  const restored = await pullBackup(localStore);
  return { user, restored, store: restored?.store ?? null };
}

/** Best-effort background backup — silent when signed out or offline. */
export async function backupIfSignedIn(store: Store): Promise<void> {
  if (!supabaseConfigured || !pulledThisSession) return;
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) await pushBackup(store);
  } catch {
    /* offline / transient — the next background pass tries again */
  }
}

/** On launch: if already signed in, read the account so pushes are unblocked. */
export async function primeSession(localStore: Store): Promise<RestoreResult | null> {
  if (!supabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    const pulled = await pullBackup(localStore);
    return pulled ?? null;
  } catch {
    return null;
  }
}
