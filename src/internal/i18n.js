const { parse } = require('path')
const languages = require('glob').sync('src/languages/*.json').map(x => parse(x).base)
const langfiles = new Map()
let preflang = `${(process.env.WILDBEAST_LANGUAGE || 'en-EN')}.json`
if (!languages.includes(preflang)) {
  logger.warn('I18N', `Language ${preflang} is requested, but no such language exists! Falling back to en-EN`)
  preflang = 'en-EN.json'
}
langfiles.set('pref', require(`../languages/${preflang}`))
languages.forEach(x => {
  langfiles.set(x, require(`../languages/${x}`))
})

module.exports = {
  /**
   * Plainly return a contextualized i18n string
   * This doesn't allow for guild-based translating, it returns all strings in the default language
   * @param {String} key - The ID of the string you want translated
   * @param {Object} opts - Object containing context keys
   * @returns {String}
   */
  translateRaw: (key, opts = {}) => {
    const langfile = langfiles.get('pref')
    if (!langfile[key]) return '[NO SUCH KEY]'
    else return contextualize(langfile[key], opts)
  },
  _files: langfiles
}

/**
 * Contextualize an i18n string
 * @param {String} key - The string to contextualize
 * @param {Object} opts - Object containing keys to use as context
 * @return {String}
 */
const contextualize = (key, opts) => {
  for (let x in opts) {
    key = key.replace(new RegExp(`{${x}`, 'g'), opts[x])
  }
  return key
}
