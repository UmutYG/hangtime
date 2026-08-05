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

/**
 * The tab slot inside whichever space is open.
 *
 * Separate from NavCtx because only tabbed spaces have one, and a screen that
 * asks for it must survive being rendered outside a tab shell — hence the
 * nullable hook rather than a throwing one.
 */
export interface TabApi {
  active: number;
  setActive: (index: number) => void;
}

export const TabCtx = createContext<TabApi | null>(null);

export function useSpaceTabs(): TabApi | null {
  return useContext(TabCtx);
}

/** where "up" leads from each view — training spaces live inside Body */
export function parentOf(view: RoofView): RoofView {
  if (view === 'pullups' || view === 'pushups' || view === 'running') return 'body';
  return 'home';
}
