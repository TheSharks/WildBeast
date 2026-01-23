import { parse } from './parser.js'
import { getLimits } from './runtime/limits.js'
import { createRegistry } from './runtime/registry.js'
import { render as renderInternal } from './runtime/renderer.js'
import { argHandler, argsHandler, argslenHandler } from './tags/args.js'
import {
  avatarHandler,
  channelidHandler,
  mentionHandler,
  serverHandler,
  serveridHandler,
  useridHandler,
  usertagHandler,
} from './tags/discord.js'
import { fetchHandler } from './tags/fetch.js'
import {
  evalHandler,
  ifHandler,
  ignoreHandler,
  noteHandler,
} from './tags/functional.js'
import { javascriptHandler, jsHandler } from './tags/js.js'
import {
  absHandler,
  addHandler,
  baseHandler,
  ceilHandler,
  chooseHandler,
  cosHandler,
  divideHandler,
  eHandler,
  floorHandler,
  mathHandler,
  modHandler,
  multiplyHandler,
  piHandler,
  powHandler,
  randomHandler,
  rangeHandler,
  roundHandler,
  sinHandler,
  sqrtHandler,
  subtractHandler,
  tanHandler,
} from './tags/math.js'
import { uuidHandler } from './tags/misc.js'
import {
  hashHandler,
  lengthHandler,
  lowerHandler,
  onelineHandler,
  replaceHandler,
  replaceregexHandler,
  reverseHandler,
  substringHandler,
  upperHandler,
  urlHandler,
} from './tags/strings.js'
import { nowHandler, timeHandler } from './tags/time.js'
import { deleteHandler, getHandler, setHandler } from './tags/variables.js'
import type {
  Ast,
  RenderContext,
  RenderOptions,
  RenderResult,
} from './types.js'

export { RenderError } from './runtime/errors.js'
export { createRegistry } from './runtime/registry.js'
export type { Ast, RenderOptions, RenderResult } from './types.js'

export const defaultRegistry = createRegistry(
  {
    args: argsHandler,
    arg: argHandler,
    argslen: argslenHandler,
    set: setHandler,
    get: getHandler,
    delete: deleteHandler,
    upper: upperHandler,
    lower: lowerHandler,
    length: lengthHandler,
    replace: replaceHandler,
    reverse: reverseHandler,
    url: urlHandler,
    substring: substringHandler,
    oneline: onelineHandler,
    hash: hashHandler,
    replaceregex: replaceregexHandler,
    math: mathHandler,
    abs: absHandler,
    sin: sinHandler,
    cos: cosHandler,
    tan: tanHandler,
    sqrt: sqrtHandler,
    floor: floorHandler,
    ceil: ceilHandler,
    round: roundHandler,
    base: baseHandler,
    pi: piHandler,
    e: eHandler,
    choose: chooseHandler,
    range: rangeHandler,
    add: addHandler,
    subtract: subtractHandler,
    multiply: multiplyHandler,
    divide: divideHandler,
    pow: powHandler,
    mod: modHandler,
    random: randomHandler,
    now: nowHandler,
    time: timeHandler,
    uuid: uuidHandler,
    userid: useridHandler,
    usertag: usertagHandler,
    mention: mentionHandler,
    channelid: channelidHandler,
    server: serverHandler,
    serverid: serveridHandler,
    avatar: avatarHandler,
    js: jsHandler,
    javascript: javascriptHandler,
  },
  {
    fetch: fetchHandler,
    if: ifHandler,
    note: noteHandler,
    ignore: ignoreHandler,
    eval: evalHandler,
  },
)

export async function render(
  input: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const mode = options.mode ?? 'ignore'
  const limits = getLimits(options)

  const enableJs = options.enableJs ?? false
  const sandbox = options.sandbox

  const context: RenderContext = {
    mode,
    registry: options.registry ?? defaultRegistry,
    variables:
      options.variables instanceof Map
        ? options.variables
        : new Map(Object.entries(options.variables ?? {})),
    args: options.args,
    discord: options.discord,
    tagStore: options.tagStore,
    sandbox: enableJs ? sandbox : undefined,
    options,
    fetchRequests: 0,
  }
  const result = await renderInternal(input, context, limits)

  if (options.variables && !(options.variables instanceof Map)) {
    for (const [key, value] of context.variables ?? []) {
      options.variables[key] = value
    }
    // Handle deletions (keys present in options.variables but not in context.variables)
    for (const key of Object.keys(options.variables)) {
      if (!context.variables?.has(key)) {
        delete options.variables[key]
      }
    }
  }

  return result
}

export function createDefaultRegistry() {
  return defaultRegistry
}

export { parse }
