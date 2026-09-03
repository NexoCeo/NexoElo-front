import { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import themes from "../themes";

type ThemeName = keyof typeof themes;
type Theme = typeof themes[ThemeName];

interface ThemeContextType {
  themeName: ThemeName;
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeName: "dark",
  theme: themes.dark,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
  const savedTheme = sessionStorage.getItem("theme") as ThemeName | null;
  if (savedTheme) return savedTheme;

  const prefersDark = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  return prefersDark ? "dark" : "light";
});


  const theme = useMemo(() => themes[themeName], [themeName]);

  const toggleTheme = () => {
    setThemeName((prev) => {
      const newTheme = prev === "light" ? "dark" : "light";
      sessionStorage.setItem("theme", newTheme);
      return newTheme;
    });
  };

  useEffect(() => {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(themeName);

    Object.entries(theme.colors).forEach(([name, value]) => {
      const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      document.documentElement.style.setProperty(`--theme-${cssName}`, value);
    });

    document.documentElement.style.setProperty("--theme-background-color", theme.colors.background);
    document.documentElement.style.setProperty("--theme-text-color", theme.colors.text);
  }, [theme, themeName]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const savedTheme = sessionStorage.getItem("theme");
      if (!savedTheme) {
        setThemeName(mediaQuery.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ themeName, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}
