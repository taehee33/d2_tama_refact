import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import {
  getUserSettings,
  normalizeSiteTheme,
  saveUserSettings,
} from "../utils/userSettingsUtils";

export const SITE_THEME_STORAGE_KEY = "siteTheme";
export const SITE_THEME_DEFAULT = "default";
export const SITE_THEME_NOTEBOOK = "notebook";
export const SITE_THEME_OPTIONS = Object.freeze([
  { id: SITE_THEME_DEFAULT, label: "기본" },
  { id: SITE_THEME_NOTEBOOK, label: "한솔이의 노트북" },
]);

const ThemeContext = createContext(null);

function readGuestTheme() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeSiteTheme(window.localStorage.getItem(SITE_THEME_STORAGE_KEY));
  } catch (error) {
    console.error("게스트 테마 로드 오류:", error);
    return null;
  }
}

function saveGuestTheme(themeId) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, themeId);
  } catch (error) {
    console.error("게스트 테마 저장 오류:", error);
  }
}

export function ThemeProvider({ children }) {
  const { currentUser } = useAuth();
  const [themeId, setThemeId] = useState(SITE_THEME_DEFAULT);
  const [isThemeLoading, setIsThemeLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const guestTheme = readGuestTheme();

    if (!currentUser?.uid) {
      setThemeId(guestTheme || SITE_THEME_DEFAULT);
      setIsThemeLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    setIsThemeLoading(true);

    const loadTheme = async () => {
      try {
        const settings = await getUserSettings(currentUser.uid);
        if (isCancelled) {
          return;
        }

        const savedTheme = normalizeSiteTheme(settings.siteTheme);
        setThemeId(savedTheme || guestTheme || SITE_THEME_DEFAULT);
      } catch (error) {
        console.error("사이트 테마 로드 오류:", error);
        if (!isCancelled) {
          setThemeId(guestTheme || SITE_THEME_DEFAULT);
        }
      } finally {
        if (!isCancelled) {
          setIsThemeLoading(false);
        }
      }
    };

    loadTheme();

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.uid]);

  const setTheme = useCallback(
    async (nextThemeId) => {
      const resolvedTheme = normalizeSiteTheme(nextThemeId) || SITE_THEME_DEFAULT;
      const previousTheme = themeId;
      setThemeId(resolvedTheme);

      if (currentUser?.uid) {
        try {
          await saveUserSettings(currentUser.uid, {
            siteTheme: resolvedTheme,
          });
        } catch (error) {
          setThemeId(previousTheme);
          throw error;
        }
        return resolvedTheme;
      }

      saveGuestTheme(resolvedTheme);
      return resolvedTheme;
    },
    [currentUser?.uid, themeId]
  );

  const value = useMemo(
    () => ({
      themeId,
      resolvedTheme: themeId,
      isThemeLoading,
      setTheme,
    }),
    [themeId, isThemeLoading, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
