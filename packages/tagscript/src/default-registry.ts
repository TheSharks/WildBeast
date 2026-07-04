import { createRegistry } from './runtime/registry.js'
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
import type { LazyTagHandler, TagHandler, TagRegistry } from './types.js'

export const webTagHandlers = {
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
} satisfies Record<string, TagHandler>

export const webLazyTagHandlers = {
  if: ifHandler,
  note: noteHandler,
  ignore: ignoreHandler,
  eval: evalHandler,
} satisfies Record<string, LazyTagHandler>

export function createWebDefaultRegistry(): TagRegistry {
  return createRegistry(webTagHandlers, webLazyTagHandlers)
}
