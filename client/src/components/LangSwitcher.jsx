import { LANGS, useLang } from '../context/LangContext.jsx';

export default function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <select
      className="lang-switcher"
      value={lang}
      onChange={e => setLang(e.target.value)}
      aria-label="Language"
    >
      {LANGS.map(l => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
