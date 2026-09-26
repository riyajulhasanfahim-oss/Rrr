import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import i18n, {
  getSavedLanguage,
  switchAppLanguage,
  translations,
  EN_TO_BN,
  BN_TO_EN,
  getCategoryDisplayName
} from '../../lib/i18n';

interface LanguageContextType {
  language: 'en' | 'bn';
  setLanguage: (lang: 'en' | 'bn') => void;
  toggleLanguage: () => void;
  t: (key: string, defaultVal?: string) => string;
  tCategory: (cat: string | undefined | null) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key: string) => key,
  tCategory: (cat: string | undefined | null) => cat || '',
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<'en' | 'bn'>(() => getSavedLanguage());

  const handleSetLanguage = (lang: 'en' | 'bn') => {
    setLanguageState(lang);
    switchAppLanguage(lang);
  };

  const handleToggleLanguage = () => {
    const next = language === 'en' ? 'bn' : 'en';
    handleSetLanguage(next);
  };

  useEffect(() => {
    const handleLangChange = (lng: string) => {
      const norm = lng.startsWith('bn') ? 'bn' : 'en';
      setLanguageState(norm);
    };

    i18n.on('languageChanged', handleLangChange);

    const handleCustomEvent = (e: any) => {
      if (e?.detail?.language) {
        setLanguageState(e.detail.language);
      }
    };
    window.addEventListener('rj-language-changed', handleCustomEvent);

    return () => {
      i18n.off('languageChanged', handleLangChange);
      window.removeEventListener('rj-language-changed', handleCustomEvent);
    };
  }, []);

  const t = useMemo(() => {
    return (key: string, defaultVal?: string): string => {
      if (!key) return '';
      const dict = translations[language] as Record<string, string>;
      if (dict && dict[key]) {
        return dict[key];
      }
      if (language === 'en' && BN_TO_EN[key]) {
        return BN_TO_EN[key];
      }
      if (language === 'bn' && EN_TO_BN[key]) {
        return EN_TO_BN[key];
      }
      return defaultVal !== undefined ? defaultVal : key;
    };
  }, [language]);

  const tCategory = useMemo(() => {
    return (cat: string | undefined | null): string => {
      return getCategoryDisplayName(cat, language);
    };
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        toggleLanguage: handleToggleLanguage,
        t,
        tCategory,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
