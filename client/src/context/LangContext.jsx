import { createContext, useContext, useState } from 'react';
import translations from '../i18n/translations.js';

const LangContext = createContext(null);

export const LANGS = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'pt', label: 'PT', name: 'Português' },
  { code: 'pl', label: 'PL', name: 'Polski' },
  { code: 'ru', label: 'RU', name: 'Русский' },
];

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'en');

  function setLang(code) {
    localStorage.setItem('lang', code);
    setLangState(code);
  }

  function t(key, vars) {
    let str = translations[lang]?.[key] ?? translations.en[key] ?? key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
    return str;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
