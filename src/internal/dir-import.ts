import { sync } from 'glob'
import { basename, extname } from 'path'

export default function (pattern: string): Record<string, any> {
  let files = sync(pattern, {
    absolute: true
  })
  // @ts-expect-error
  if (process[Symbol.for('ts-node.register.instance')] !== undefined) {
    files = files.filter(x => x.endsWith('.ts'))
  } else {
    files = files.filter(x => x.endsWith('.js'))
  }
  let returnval = {}
  files.forEach(x => {
    const base = basename(x, extname(x))
    returnval = Object.assign(returnval, { [base]: require(x) })
  })
  return returnval
}
