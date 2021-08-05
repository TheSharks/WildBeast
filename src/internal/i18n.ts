import { IntlMessageFormat } from 'intl-messageformat'
import { error, info } from '../components/logger'
import { cache } from '../cache'

const defaultLang = process.env.WILDBEAST_LANGUAGE ?? 'en-EN'

info(`Cache contains ${Object.keys(cache.languages.size).length} languages, using default language ${defaultLang}`, 'i18n')

if (!cache.languages.has(defaultLang)) {
  error(`Default language ${defaultLang} not found in cache!`, 'i18n')
}

export function t (key: string, args?: Record<string, any>, lang?: string): string {
  try {
    const msg = key.split('.').reduce((o, i) => o?.[i], lang !== undefined ? cache.languages.get(lang) : cache.languages.get(defaultLang)) as any
    if (!(typeof msg === 'string')) error(`Translation key ${key} not found in cache!`, 'i18n')
    return new IntlMessageFormat(typeof msg === 'string' ? msg : '[TRANSLATION FAILED]').format(args)
  } catch (e) {
    error(`Failed to translate ${key}`, 'i18n')
    error(e, 'i18n')
    return '[TRANSLATION FAILED]'
  }
}
