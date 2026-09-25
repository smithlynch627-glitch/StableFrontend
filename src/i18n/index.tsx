import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type DictKey } from './en';
import { ko } from './ko';

export type Lang = 'en' | 'ko';
type Vars = Record<string, string | number>;
export type T = (key: DictKey, vars?: Vars) => string;

const dicts: Record<Lang, Partial<Record<DictKey, string>>> = { en, ko };
const STORAGE_KEY = 'giwa.lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ko') return saved;
  } catch {}
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback<T>(
    (key, vars) => {
      const d = dicts[lang];
      const pluralKey = vars && Number(vars.n) === 1 ? (`${key}_one` as DictKey) : null;
      let s = (pluralKey && (d[pluralKey] ?? en[pluralKey as keyof typeof en])) || d[key] || en[key] || key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
