import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translations, type SupportedLang, type TranslationKeys } from "@/translations";

type LanguageContextValue = {
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  t: (key: TranslationKeys) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectLanguage(): SupportedLang {
  if (typeof navigator === "undefined") return "pt";
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const preference of preferences) {
    const code = preference.toLowerCase().split("-")[0];
    if (code === "pt" || code === "en") return code;
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Detect before first render to avoid a flash of untranslated content.
  const [lang, setLang] = useState<SupportedLang>(detectLanguage);
  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  }, [lang]);
  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    setLang,
    t: (key: TranslationKeys) => translations[lang][key],
  }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
