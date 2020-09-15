const dirreq = require('./dir-require')
const logger = require('./logger')
const languages = dirreq('src/languages/**/*.json')
const IntlMessageFormat = require('intl-messageformat').default
const defaultlang = process.env.WILDBEAST_LANGUAGE || 'en-EN'

logger.debug('I18N', `Loaded ${Object.keys(languages).length} language(s), using ${defaultlang} as default`)

module.exports = {
  t (key, ctx) {
    try {
      const msg = key.split('.').reduce((o, i) => o[i], languages[defaultlang])
      return new IntlMessageFormat(msg, defaultlang).format(ctx)
    } catch (e) {
      logger.error('I18N', e)
      return '[TRANSLATION FAILED]'
    }
  }
}
