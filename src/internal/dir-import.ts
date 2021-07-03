import { sync } from 'glob'
import { basename, extname } from 'path'

export default function (pattern: string): Record<string, any> {
  const files = sync(pattern, {
    absolute: true
  })
  let returnval = {}
  files.forEach(x => {
    const base = basename(x, extname(x))
    returnval = Object.assign(returnval, { [base]: require(x) })
  })
  return returnval
}
