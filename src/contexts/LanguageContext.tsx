import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { type Lang, translations } from "@/i18n/translations";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("kronos-lang");
    return (saved === "es" || saved === "en") ? saved : "ca";
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("kronos-lang", newLang);
  }, []);

  const t = useCallback((key: string): string => {
    if (lang === "ca") return key;
    return translations[lang][key] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useT must be used within LanguageProvider");
  return context;
}
