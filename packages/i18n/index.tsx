import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { en } from './en'
import { zh } from './zh'

export type Locale = 'en' | 'zh'
export type Translations = typeof en

// Nested section types — use these for typed hook access: Translations['events'], Translations['marketData'], etc.
export type LocaleDict = Translations

export const translations: Record<Locale, Translations> = { en, zh }

interface I18nContextValue {
  locale: Locale
  t: Translations
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem('locale') as Locale | null
    return stored === 'zh' ? 'zh' : 'en'
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }, [])

  const t = translations[locale]

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider')
  return ctx
}
