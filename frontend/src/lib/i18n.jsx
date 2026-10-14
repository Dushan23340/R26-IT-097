import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { platformApi } from "@/lib/platformApi";
import { SI } from "@/lib/i18n-si";

// Interface language: English (default) or Sinhala.
//
// Strings are looked up by their English text - t("Dashboard") - so a
// screen can be translated one string at a time and anything not yet in
// the Sinhala dictionary simply stays in English. Lesson and quiz content
// (generated questions, notes) is not translated.
//
// The choice is kept in localStorage (so the sign-in page already shows
// it) and on the account (core.users.language) so it follows the user to
// another device.
const LANGS = { en: "English", si: "සිංහල" };
const STORAGE_KEY = "lang";

const I18nContext = createContext({ lang: "en", setLang: () => {}, t: (s) => s });

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && LANGS[v] ? v : "en";
  } catch {
    return "en";
  }
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

function I18nProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [lang, setLangState] = useState(readStored);

  // A signed-in user's saved language wins over this browser's.
  useEffect(() => {
    if (user?.language && LANGS[user.language] && user.language !== lang) setLangState(user.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.language]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // storage unavailable
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (next) => {
      if (!LANGS[next]) return;
      setLangState(next);
      if (user?.id) {
        platformApi
          .setLanguage(user.id, next)
          .then((res) => res?.user && updateUser?.(res.user))
          .catch(() => {
            // kept locally; saved to the account next time
          });
      }
    },
    [user?.id, updateUser]
  );

  const t = useCallback(
    (text, vars) => {
      if (typeof text !== "string") return text;
      const translated = lang === "si" ? SI[text] : null;
      return interpolate(translated || text, vars);
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t, langs: LANGS }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  return useContext(I18nContext);
}

function useT() {
  return useContext(I18nContext).t;
}

// Small EN / සිං switch for the header and the sign-in pages.
function LanguageToggle({ className = "" }) {
  const { lang, setLang } = useI18n();
  return (
    <div role="group" aria-label="Language" className={`inline-flex items-center rounded-full border border-border/70 bg-secondary/40 p-0.5 text-xs font-semibold ${className}`}>
      {[
        ["en", "EN"],
        ["si", "සිං"],
      ].map(([code, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          title={LANGS[code]}
          className={`h-7 min-w-9 px-2.5 rounded-full transition-colors ${lang === code ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          style={lang === code ? { background: "var(--gradient-primary)" } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export { I18nProvider, LanguageToggle, useI18n, useT };
