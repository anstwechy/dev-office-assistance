import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { THEME_STORAGE_KEY, getPreset, parseStoredThemeId, type AppThemeId, type AppThemePreset } from "./presets";
import { buildMantineTheme, getMantineThemeForId, type AppMantineTheme } from "./mantineThemeFor";

type Ctx = {
  themeId: AppThemeId;
  setThemeId: (id: AppThemeId) => void;
  preset: AppThemePreset;
  mantineTheme: AppMantineTheme;
};

const AppThemeStateContext = createContext<Ctx | null>(null);

function readInitialId(): AppThemeId {
  if (typeof document !== "undefined") {
    const d = document.documentElement.getAttribute("data-app-theme");
    if (d && (d === "ember" || d === "teal" || d === "violet")) {
      return d;
    }
  }
  if (typeof window === "undefined") return "ember";
  try {
    return parseStoredThemeId(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "ember";
  }
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<AppThemeId>(readInitialId);

  const setThemeId = useCallback((id: AppThemeId) => {
    setThemeIdState(id);
  }, []);

  const preset = useMemo(() => getPreset(themeId), [themeId]);
  const mantineTheme = useMemo(() => buildMantineTheme(preset), [preset]);

  useEffect(() => {
    document.documentElement.setAttribute("data-app-theme", themeId);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", preset.metaThemeColor);
    }
  }, [themeId, preset.metaThemeColor]);

  const value = useMemo<Ctx>(
    () => ({ themeId, setThemeId, preset, mantineTheme }),
    [themeId, setThemeId, preset, mantineTheme],
  );

  return <AppThemeStateContext.Provider value={value}>{children}</AppThemeStateContext.Provider>;
}

export function useAppTheme() {
  const c = useContext(AppThemeStateContext);
  if (!c) {
    throw new Error("useAppTheme must be used under AppThemeProvider");
  }
  return c;
}

export function useMantineThemeForThemeId(themeId: AppThemeId) {
  return useMemo(() => getMantineThemeForId(themeId), [themeId]);
}
