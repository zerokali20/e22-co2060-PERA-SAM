import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './translations';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Language = 'en' | 'si' | 'ta';

interface LanguageContextValue {
  language: Language;
  setLanguage: (l: Language) => Promise<void>;
  t: (key: string, fallback?: string) => string;
}

// ── Context ───────────────────────────────────────────────────────────────────

const LANGUAGE_KEY = '@perasam:language';

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  t: (key: string, fallback?: string) => fallback ?? key,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  // Load persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((stored) => {
        if (stored === 'en' || stored === 'si' || stored === 'ta') {
          setLanguageState(stored);
        }
      })
      .catch(() => {
        // Ignore read errors — default to 'en'
      });
  }, []);

  // Persist + update language
  const setLanguage = useCallback(async (l: Language): Promise<void> => {
    setLanguageState(l);
    await AsyncStorage.setItem(LANGUAGE_KEY, l).catch(() => {});
  }, []);

  // Translation lookup — falls back to English, then to fallback, then to humanized key
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const langDict = translations[language];
      if (langDict && key in langDict && langDict[key]) return langDict[key];
      const enDict = translations['en'];
      if (enDict && key in enDict && enDict[key]) return enDict[key];
      if (fallback !== undefined && fallback !== '') return fallback;
      // If the key is formatted like "map.cat.vehicle_bearing", never expose raw key!
      if (key.includes('.')) {
        const lastPart = key.split('.').pop() || '';
        if (lastPart === 'vehicle_bearing') return 'Bearing';
        if (lastPart === 'industrial') return 'General';
        if (lastPart) {
          return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/_/g, ' ');
        }
      }
      return key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
