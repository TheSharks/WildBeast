import { WorkScope } from './work.mjs'

export type StopReason = 'shutdown' | 'handoff' | 'startup-failed'
export interface Resource {
  close(reason: StopReason): Promise<void>
}
export interface ResourceFactory {
  name: string
  /** A factory must unwind its own partial acquisition if it rejects. */
  open(signal: AbortSignal): Promise<Resource>
}

export type RuntimePhase =
  | 'new'
  | 'starting'
  | 'ready'
  | 'stopping'
  | 'stopped'
  | 'failed'

/** One owner for every resource; factories are listed in dependency order. */
export class ApplicationRuntime {
  public readonly work: WorkScope
  private currentPhase: RuntimePhase = 'new'
  private readonly resources: Array<Resource & { name: string }> = []
  private startup?: Promise<void>
  private stopping?: Promise<void>

  public constructor(
    private readonly factories: readonly ResourceFactory[],
    private readonly drainTimeoutMs = 10_000,
    work = new WorkScope(),
  ) {
    this.work = work
  }

  public get phase(): RuntimePhase {
    return this.currentPhase
  }

  public start(): Promise<void> {
    if (
      this.startup &&
      (this.currentPhase === 'starting' || this.currentPhase === 'ready')
    )
      return this.startup
    if (this.currentPhase !== 'new')
      return Promise.reject(new Error('Runtime cannot restart'))
    this.currentPhase = 'starting'
    this.startup = this.acquire()
    return this.startup
  }

  private async acquire(): Promise<void> {
    try {
      for (const factory of this.factories) {
        this.work.signal.throwIfAborted()
        const resource = await factory.open(this.work.signal)
        this.resources.push({
          name: factory.name,
          close: (reason) => resource.close(reason),
        })
      }
      this.work.signal.throwIfAborted()
      this.work.open()
      this.currentPhase = 'ready'
    } catch (error) {
      this.work.close()
      this.currentPhase = 'failed'
      const failures = await this.release('startup-failed')
      throw new AggregateError([error, ...failures], 'WildBeast startup failed')
    }
  }

  public stop(reason: Exclude<StopReason, 'startup-failed'>): Promise<void> {
    if (this.stopping) return this.stopping
    this.currentPhase = 'stopping'
    this.work.close()
    this.stopping = this.finish(reason)
    return this.stopping
  }

  private async finish(
    reason: Exclude<StopReason, 'startup-failed'>,
  ): Promise<void> {
    await this.startup?.catch(() => {
      /* acquisition already unwinds its resources */
    })
    try {
      // If draining times out, the process supervisor must terminate this worker.
      // Never close storage underneath work that is still running.
      await this.work.drain(this.drainTimeoutMs)
      const failures = await this.release(reason)
      if (failures.length)
        throw new AggregateError(failures, 'WildBeast teardown failed')
      this.currentPhase = 'stopped'
    } catch (error) {
      this.currentPhase = 'failed'
      throw error
    }
  }

  private async release(reason: StopReason): Promise<Error[]> {
    const failures: Error[] = []
    for (const resource of this.resources.splice(0).reverse()) {
      try {
        await resource.close(reason)
      } catch (cause) {
        failures.push(new Error(`Failed to close ${resource.name}`, { cause }))
      }
    }
    return failures
  }
}
