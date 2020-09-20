const dirreq = require('./dir-require')
const logger = require('./logger')
const languages = dirreq('src/languages/**/*.json')
const IntlMessageFormat = require('intl-messageformat').default
const defaultLang = process.env.WILDBEAST_LANGUAGE || 'en-EN'

logger.debug('I18N', `Loaded ${Object.keys(languages).length} language(s), using ${defaultLang} as default`)

module.exports = {
  t (key, ctx, lang) {
    try {
      const msg = key.split('.').reduce((o, i) => o[i], languages[lang] || languages[defaultLang])
      return new IntlMessageFormat(msg, defaultLang).format(ctx)
    } catch (e) {
      logger.error('I18N', e)
      return '[TRANSLATION FAILED]'
    }
  },
  _languages: languages
}
