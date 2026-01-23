import type { RenderContext, TagHandler } from '../types.js'

// Helper to create binary operation handlers
const createBinaryOpHandler = (
  operation: (a: number, b: number) => number,
): TagHandler => {
  return (_ctx: RenderContext, args: string[]) => {
    if (args.length < 2) return ''
    const a = parseFloat(args[0] ?? '')
    const b = parseFloat(args[1] ?? '')
    if (isNaN(a) || isNaN(b)) return ''
    return String(operation(a, b))
  }
}

// Helper to create unary operation handlers
const createUnaryOpHandler = (operation: (x: number) => number): TagHandler => {
  return (_ctx: RenderContext, args: string[]) => {
    const num = parseFloat(args[0] ?? '0')
    if (isNaN(num)) return 'NaN'
    return String(operation(num))
  }
}

export const mathHandler: TagHandler = (
  _ctx: RenderContext,
  args: string[],
) => {
  if (args.length === 0) return ''

  const precedence: Record<string, number> = {
    '^': 4,
    '%': 3,
    '*': 3,
    '/': 3,
    '+': 2,
    '-': 2,
  }

  const tokens: Array<{ type: 'num' | 'str' | 'op'; value: string }> = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? ''
    const isOp = i % 2 === 1

    if (isOp) {
      if (precedence[arg] !== undefined) {
        tokens.push({ type: 'op', value: arg })
      }
    } else {
      const num = parseFloat(arg)
      if (!isNaN(num)) {
        tokens.push({ type: 'num', value: arg })
      } else {
        tokens.push({ type: 'str', value: arg })
      }
    }
  }

  const applyBinaryOp = (a: string, op: string, b: string): string => {
    const numA = parseFloat(a)
    const numB = parseFloat(b)
    const isNumeric = !isNaN(numA) && !isNaN(numB)

    if (isNumeric) {
      switch (op) {
        case '+':
          return String(numA + numB)
        case '-':
          return String(numA - numB)
        case '*':
          return String(numA * numB)
        case '/':
          if (numB === 0) return 'Error: division by zero'
          return String(numA / numB)
        case '^':
          return String(numA ** numB)
        case '%':
          if (numB === 0) return 'Error: modulo by zero'
          return String(numA % numB)
      }
    }

    switch (op) {
      case '+':
        return a + b
      case '-':
        return a.replace(b, '')
      default:
        return a + op + b
    }
  }

  const values: string[] = []
  const ops: string[] = []

  for (const token of tokens) {
    if (token.type === 'op') {
      while (
        ops.length > 0 &&
        ops[ops.length - 1] !== '(' &&
        precedence[ops[ops.length - 1]] >= precedence[token.value]
      ) {
        const b = values.pop()
        const a = values.pop()
        const poppedOp = ops.pop()
        if (a !== undefined && b !== undefined && poppedOp) {
          values.push(applyBinaryOp(a, poppedOp, b))
        }
      }
      ops.push(token.value)
    } else {
      values.push(token.value)
    }
  }

  while (ops.length > 0) {
    const b = values.pop()
    const a = values.pop()
    const op = ops.pop()
    if (a !== undefined && b !== undefined && op) {
      values.push(applyBinaryOp(a, op, b))
    }
  }

  return values.length > 0 ? values[0] : ''
}

export const absHandler = createUnaryOpHandler(Math.abs)
export const sinHandler = createUnaryOpHandler(Math.sin)
export const cosHandler = createUnaryOpHandler(Math.cos)
export const tanHandler = createUnaryOpHandler(Math.tan)
export const floorHandler = createUnaryOpHandler(Math.floor)
export const ceilHandler = createUnaryOpHandler(Math.ceil)
export const roundHandler = createUnaryOpHandler(Math.round)

export const randomHandler: TagHandler = (
  _ctx: RenderContext,
  args: string[],
) => {
  const min = parseInt(args[0] ?? '0', 10)
  const max = parseInt(args[1] ?? '100', 10)
  if (isNaN(min) || isNaN(max)) return ''
  if (min > max) return 'Error: min cannot be greater than max'
  return String(Math.floor(Math.random() * (max - min + 1)) + min)
}

export const sqrtHandler: TagHandler = (
  _ctx: RenderContext,
  args: string[],
) => {
  const num = parseFloat(args[0] ?? '0')
  if (isNaN(num)) return 'NaN'
  if (num < 0) return 'Error: cannot calculate square root of negative number'
  return String(Math.sqrt(num))
}

export const baseHandler: TagHandler = (
  _ctx: RenderContext,
  args: string[],
) => {
  if (args.length < 2) return ''
  const num = parseFloat(args[0] ?? '')
  const radix = parseInt(args[1] ?? '10', 10)
  if (isNaN(num) || isNaN(radix)) return ''
  if (radix < 2 || radix > 36) return 'Error: base must be between 2 and 36'
  return Math.floor(num).toString(radix)
}

export const piHandler: TagHandler = () => String(Math.PI)
export const eHandler: TagHandler = () => String(Math.E)

export const chooseHandler: TagHandler = (
  _ctx: RenderContext,
  args: string[],
) => {
  const input = args[0] ?? ''
  if (!input) return ''
  const parts = input.split('|')
  const index = Math.floor(Math.random() * parts.length)
  return parts[index] ?? ''
}

export const rangeHandler: TagHandler = (
  _ctx: RenderContext,
  args: string[],
) => {
  const start = parseInt(args[0] ?? '0', 10)
  const end = parseInt(args[1] ?? '0', 10)
  const step = parseInt(args[2] ?? '1', 10)

  if (isNaN(start) || isNaN(end) || isNaN(step)) return ''
  if (step <= 0) return 'Error: step must be positive'

  const count = Math.ceil((end - start) / step)
  if (count > 2000) return 'Range limit exceeded'

  const result: string[] = []
  for (let i = start; i < end; i += step) {
    result.push(String(i))
  }
  return result.join(' ')
}

export const addHandler = createBinaryOpHandler((a, b) => a + b)
export const subtractHandler = createBinaryOpHandler((a, b) => a - b)
export const multiplyHandler = createBinaryOpHandler((a, b) => a * b)
export const divideHandler = createBinaryOpHandler((a, b) => a / b)
export const powHandler = createBinaryOpHandler((a, b) => a ** b)
export const modHandler = createBinaryOpHandler((a, b) => a % b)
