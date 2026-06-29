import enMessages from './locales/en.json'
import esMessages from './locales/es.json'
import frMessages from './locales/fr.json'

export type ErrorMessages = typeof enMessages

// Registry: locale name -> messages map
const locales: Record<string, ErrorMessages> = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
}

/** Detects the user's system locale in browser and Node environments. */
export function detectLocale(): string {
  // 1. Browser context detection
  if (typeof globalThis !== 'undefined' && globalThis.navigator) {
    const nav = globalThis.navigator;
    if (nav.languages && nav.languages.length > 0) {
      for (const lang of nav.languages) {
        const code = lang.split('-')[0].toLowerCase();
        if (locales[code]) return code;
      }
    }
    if (nav.language) {
      const code = nav.language.split('-')[0].toLowerCase();
      if (locales[code]) return code;
    }
  }

  // 2. Node.js environment context detection
  if (typeof process !== 'undefined' && process.env) {
    const envKeys = ['LANG', 'LANGUAGE', 'LC_ALL', 'LC_MESSAGES'];
    for (const key of envKeys) {
      const val = process.env[key];
      if (val) {
        // Handle values like en_US.UTF-8, es-ES, etc.
        const code = val.split('.')[0].split('_')[0].split('-')[0].toLowerCase();
        if (locales[code]) return code;
      }
    }
  }

  // 3. Fallback to English
  return 'en';
}

let activeLocale = detectLocale()

/** Register a locale and switch to it. Optionally register new messages map. */
export function setLocale(locale: string, messages?: ErrorMessages): void {
  if (messages) {
    locales[locale] = messages
  }
  if (locales[locale]) {
    activeLocale = locale
  } else {
    activeLocale = 'en'
  }
}

/** Retrieves translated message with fallback chain to English. */
function getMessage(code: string): string {
  const activeMsgs = locales[activeLocale] ?? locales['en']
  const enMsgs = locales['en']

  // 1. Try to get translation in active locale
  if (activeMsgs && (activeMsgs as Record<string, string>)[code]) {
    return (activeMsgs as Record<string, string>)[code]
  }

  // 2. Fallback to English translation
  if (enMsgs && (enMsgs as Record<string, string>)[code]) {
    return (enMsgs as Record<string, string>)[code]
  }

  // 3. Fallback to Unknown message in active locale
  if (activeMsgs && (activeMsgs as Record<string, string>)['Unknown']) {
    return (activeMsgs as Record<string, string>)['Unknown']
  }

  // 4. Fallback to Unknown message in English
  if (enMsgs && (enMsgs as Record<string, string>)['Unknown']) {
    return (enMsgs as Record<string, string>)['Unknown']
  }

  return 'Unknown error'
}

export function mapError(err: any): Error {
  const code: string | undefined = err?.code
  // If no code, pass through the original error/message unchanged
  if (!code) {
    return err instanceof Error ? err : new Error(err?.message ?? getMessage('Unknown'))
  }
  const message = getMessage(code)
  const error = new Error(message)
  ;(error as any).code = code
  return error
}

