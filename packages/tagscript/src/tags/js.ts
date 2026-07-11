import { RenderError } from '../runtime/errors.js'
import type { RenderContext } from '../types.js'

export async function jsHandler(
  ctx: RenderContext,
  args: string[],
): Promise<string> {
  const sandbox = ctx.sandbox

  if (!sandbox) {
    throw new RenderError(
      'JavaScript execution is not enabled. Use enableJs: true with a sandbox option.',
    )
  }

  const code = args[0] || ''
  const result = await sandbox.execute(code)

  if (typeof result === 'object' && result !== null) {
    if ('attachment' in result && result.attachment) {
      ctx.attachment = result.attachment
    }
    if ('text' in result) {
      return result.text
    }
  }

  // we expect an isolated-vm like result with a text property
  // but fall back to string conversion if not
  return String(result ?? '')
}

export const javascriptHandler = jsHandler
