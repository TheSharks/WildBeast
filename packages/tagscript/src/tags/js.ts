import type { RenderContext } from '../types.js'

export async function jsHandler(
  ctx: RenderContext,
  args: string[],
): Promise<string> {
  const sandbox = ctx.sandbox

  if (!sandbox) {
    throw new Error(
      'JavaScript execution is not enabled. Use enableJs: true with a sandbox option.',
    )
  }

  const code = args[0] || ''
  const result = await sandbox.execute(code)
  // we expect a isolated-vm like result with a text property
  // but fall back to string conversion if not
  return typeof result === 'object' && result !== null && 'text' in result
    ? result.text
    : String(result ?? '')
}

export const javascriptHandler = jsHandler
