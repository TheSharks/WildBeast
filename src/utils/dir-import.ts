import { sync } from 'fast-glob'

const IS_TS_NODE = Symbol.for('ts-node.register.instance') in process

export default async function (pattern: string): Promise<void> {
  let files = sync(pattern, {
    absolute: true
  })
  if (IS_TS_NODE) {
    files = files.filter(x => x.endsWith('.ts'))
  } else {
    files = files.filter(x => x.endsWith('.js'))
  }
  files.forEach(async x => {
    await import(x)
  })
}
