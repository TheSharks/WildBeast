import { jobs } from '../cache'
import { debug } from '../utils/logger'

type JobFunction = () => Promise<any>

export class Job {
  lastRun: number | null = null
  jobFn: JobFunction
  constructor (public name: string, jobFn?: JobFunction) {
    this.name = name
    this.jobFn = jobFn ?? (async () => await Promise.resolve())
    if (jobs.has(name)) {
      throw new Error(`Job ${name} already exists`)
    }
    jobs.set(name, this)
  }

  async run (): Promise<void> {
    debug(`Running job ${this.name}`, 'Jobs')
    this.lastRun = Date.now()
    await this.jobFn()
    debug(`Finished job ${this.name}`, 'Jobs')
  }

  setExec (jobFn: JobFunction): this {
    this.jobFn = jobFn
    return this
  }
}

export class ScheduledJob extends Job {
  nextRun: number | null = null
  interval: number | undefined = undefined
  _interval: NodeJS.Timer | null = null
  constructor (name: string, interval?: number, jobFn?: JobFunction) {
    super(name, jobFn)
    this.interval = interval
  }

  get running (): boolean {
    return this._interval !== null
  }

  setInterval (interval: number): this {
    this.interval = interval
    return this
  }

  start (): this {
    if (this.interval === undefined) {
      throw new Error('Cannot start job with no interval')
    }
    debug(`Starting job ${this.name}, scheduled every ${this.interval}`, 'Job scheduler')
    this._interval = setInterval(async () => {
      await super.run()
      this.nextRun = Date.now() + this.interval!
      debug(`Next run for ${this.name} is ${this.nextRun}`, 'Job scheduler')
    }, this.interval)
    return this
  }

  stop (): this {
    debug(`Stopping job ${this.name}`, 'Job scheduler')
    if (this._interval !== null) {
      clearInterval(this._interval)
    }
    return this
  }
}
