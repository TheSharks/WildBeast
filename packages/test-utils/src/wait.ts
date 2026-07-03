export interface WaitUntilOptions {
  timeoutMillis?: number
  intervalMillis?: number
  message?: string
}

/** Poll a condition until it holds or the timeout elapses. */
export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  options: WaitUntilOptions = {},
): Promise<void> {
  const timeoutMillis = options.timeoutMillis ?? 8_000
  const intervalMillis = options.intervalMillis ?? 50
  const deadline = Date.now() + timeoutMillis

  while (Date.now() < deadline) {
    if (await condition()) return
    await new Promise((resolveSleep) =>
      setTimeout(resolveSleep, intervalMillis),
    )
  }
  throw new Error(options.message ?? 'condition not met in time')
}
