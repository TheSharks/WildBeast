import { sync } from 'glob'

export default async function (pattern: string): Promise<void> {
  let files = sync(pattern, {
    absolute: true
  })
  // @ts-expect-error
  if (process[Symbol.for('ts-node.register.instance')] !== undefined) {
    files = files.filter(x => x.endsWith('.ts'))
  } else {
    files = files.filter(x => x.endsWith('.js'))
  }
  files.forEach(async x => {
    await import(x)
  })
}
