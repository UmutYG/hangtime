import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Lang, translate } from "./i18n";
import {
  Settings,
  defaultSettings,
  loadSettings,
  persistSettings,
} from "./settings";

type Ctx = {
  settings: Settings;
  ready: boolean;
  lang: Lang;
  t: (key: string) => string;
  update: (patch: Partial<Settings>) => Promise<void>;
  reload: () => Promise<void>;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setReady(true);
    });
  }, []);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persistSettings(next);
        return next;
      });
    },
    []
  );

  const t = useCallback(
    (key: string) => translate(settings.language, key),
    [settings.language]
  );

  const reload = useCallback(async () => {
    const s = await loadSettings();
    setSettings(s);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, ready, lang: settings.language, t, update, reload }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
