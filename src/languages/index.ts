import deepmerge from 'deepmerge'
import glob from 'fast-glob'
import { basename, extname, relative, sep } from 'path'
import { languages } from '../cache'
import { debug } from '../utils/logger'

export default async function (): Promise<void> {
  const files = await glob('**/*.strings.[?jt]s', {
    absolute: true,
    cwd: __dirname
  })
  for (const file of files) {
    const name = basename(file, `.strings${extname(file)}`)
    const relativePath = relative(__dirname, file)
    const [language, ...categories] = relativePath.split(sep).slice(0, -1)
    const strings = await import(file)
    // input: ['a', 'b', 'c']
    // output: { a: { b: { c: 'foo' } } }
    const obj = categories.reduce((o, c) => ({ [c]: o }), { [name]: strings.default })
    if (languages.has(language)) {
      const original = languages.get(language)
      languages.set(language, deepmerge(original!, obj))
    } else {
      languages.set(language, obj)
    }
    debug(`Language ${language} updated for ${categories.join('.')}.${name} with ${Object.keys(strings.default).length} definitions`, 'Languages')
  }
}
