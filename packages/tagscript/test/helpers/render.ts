import { render as baseRender } from '../../src/index.js'
import { recheckSafety } from '../../src/recheck.js'

/** `render` with the recheck checker installed, for tests of the regex tags. */
export const render: typeof baseRender = (input, options = {}) =>
  baseRender(input, { regexSafety: recheckSafety, ...options })
