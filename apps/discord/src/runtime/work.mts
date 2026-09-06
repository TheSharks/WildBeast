export class WorkRejected extends Error {
  public constructor() {
    super('WildBeast is not accepting work')
  }
}

/** All commands, events and scheduled work enter here before touching services. */
export class WorkScope {
  private accepting = false
  private readonly controller = new AbortController()
  private readonly pending = new Set<Promise<unknown>>()

  public get signal(): AbortSignal {
    return this.controller.signal
  }

  public open(): void {
    this.signal.throwIfAborted()
    this.accepting = true
  }

  public run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (!this.accepting) return Promise.reject(new WorkRejected())
    const result = Promise.resolve().then(() => operation(this.signal))
    this.pending.add(result)
    void result
      .finally(() => this.pending.delete(result))
      .catch(() => {
        // The caller receives the original rejection; tracking never creates another.
      })
    return result
  }

  public close(): void {
    this.accepting = false
    this.controller.abort()
  }

  public async drain(timeoutMs: number): Promise<void> {
    if (this.accepting) throw new Error('Close admission before draining work')
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new Error('Invalid drain timeout')
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        Promise.allSettled([...this.pending]),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Work drain deadline exceeded')),
            timeoutMs,
          )
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }
}
