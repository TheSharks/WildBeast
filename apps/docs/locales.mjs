// @ts-check
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Languages the docs can be translated into, keyed by the directory and URL
 * segment Starlight uses. The set mirrors Discord's locale list, which is
 * also what the bot's translations follow; `crowdin.yml` at the repo root
 * maps Crowdin's language codes onto these keys. Labels are Discord's native
 * names, except Russian (Discord's starts with a Latin "P") and Simplified
 * Chinese (Discord's bare "中文" is ambiguous next to Traditional).
 *
 * Translations aren't committed. Crowdin writes them to
 * `src/content/docs/<key>/` at build time, and only a language whose
 * directory exists is turned on, so a checkout without translations builds
 * the English site alone.
 *
 * @type {Record<string, { label: string, lang: string }>}
 */
export const translatedLocales = {
  bg: { label: 'български', lang: 'bg' },
  cs: { label: 'Čeština', lang: 'cs' },
  da: { label: 'Dansk', lang: 'da' },
  de: { label: 'Deutsch', lang: 'de' },
  el: { label: 'Ελληνικά', lang: 'el' },
  'en-gb': { label: 'English, UK', lang: 'en-GB' },
  es: { label: 'Español', lang: 'es' },
  'es-419': { label: 'Español, LATAM', lang: 'es-419' },
  fi: { label: 'Suomi', lang: 'fi' },
  fr: { label: 'Français', lang: 'fr' },
  hi: { label: 'हिन्दी', lang: 'hi' },
  hr: { label: 'Hrvatski', lang: 'hr' },
  hu: { label: 'Magyar', lang: 'hu' },
  id: { label: 'Bahasa Indonesia', lang: 'id' },
  it: { label: 'Italiano', lang: 'it' },
  ja: { label: '日本語', lang: 'ja' },
  ko: { label: '한국어', lang: 'ko' },
  lt: { label: 'Lietuviškai', lang: 'lt' },
  nl: { label: 'Nederlands', lang: 'nl' },
  no: { label: 'Norsk', lang: 'no' },
  pl: { label: 'Polski', lang: 'pl' },
  'pt-br': { label: 'Português do Brasil', lang: 'pt-BR' },
  ro: { label: 'Română', lang: 'ro' },
  ru: { label: 'Русский', lang: 'ru' },
  sv: { label: 'Svenska', lang: 'sv' },
  th: { label: 'ไทย', lang: 'th' },
  tr: { label: 'Türkçe', lang: 'tr' },
  uk: { label: 'Українська', lang: 'uk' },
  vi: { label: 'Tiếng Việt', lang: 'vi' },
  'zh-cn': { label: '简体中文', lang: 'zh-CN' },
  'zh-tw': { label: '繁體中文', lang: 'zh-TW' },
}

/** English at the site root, plus every language Crowdin has delivered. */
export function availableLocales() {
  /** @type {Record<string, { label: string, lang: string }>} */
  const locales = { root: { label: 'English', lang: 'en' } }
  for (const [key, locale] of Object.entries(translatedLocales)) {
    const directory = new URL(`./src/content/docs/${key}/`, import.meta.url)
    if (existsSync(fileURLToPath(directory))) locales[key] = locale
  }
  return locales
}
