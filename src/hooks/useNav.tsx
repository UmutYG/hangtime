import { createContext, useContext } from 'react';
import type { AppMode } from '../theme';

/** The matryoshka: home lists life areas; Body is an area page holding the
 *  three training spaces; Mind and Supplements are areas that ARE their space.
 *  Deliberately UI state, not store state — the app always launches at home. */
export type RoofView = 'home' | 'body' | AppMode;

export interface NavApi {
  view: RoofView;
  go: (view: RoofView) => void;
  /** one level out: training space → Body; area → home */
  goUp: () => void;
  goHome: () => void;
}

export const NavCtx = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const api = useContext(NavCtx);
  if (!api) throw new Error('useNav outside NavCtx provider');
  return api;
}

/** where "up" leads from each view — training spaces live inside Body */
export function parentOf(view: RoofView): RoofView {
  if (view === 'pullups' || view === 'pushups' || view === 'running') return 'body';
  return 'home';
}
