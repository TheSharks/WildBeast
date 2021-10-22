import { IntlMessageFormat } from 'intl-messageformat'
import { error, fatal } from './logger'
import { languages } from '../cache'

const defaultLang = process.env.WILDBEAST_LANGUAGE ?? 'en-EN'

export function translate (key: string, args?: Record<string, any>, lang?: string): string {
  if (!languages.has(defaultLang)) {
    fatal(`Default language ${defaultLang} not found in cache!`, 'i18n')
  }
  try {
    const msg = traverse(key, lang)
    if (!(typeof msg === 'string')) error(`Translation key ${key} not found in cache!`, 'i18n')
    return new IntlMessageFormat(typeof msg === 'string' ? msg : '[TRANSLATION FAILED]').format(args)
  } catch (e) {
    error(`Failed to translate ${key}`, 'i18n')
    error(e as any, 'i18n')
    return '[TRANSLATION FAILED]'
  }
}

export function traverse (key: string, lang?: string): any {
  return key.split('.').reduce((o, i) => o?.[i], lang !== undefined ? languages.get(lang) : languages.get(defaultLang)) as any
}
