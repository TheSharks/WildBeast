---
description: >-
  Jobs are a simple way to run code asynchronously on a set schedule, or
  whenever you need to.
---

# Jobs

## Basic setup

A job either extends the `Job` class, or the `ScheduledJob` class, a scheduled job will run on a set time schedule and a normal job runs when called

Jobs are indexed and required based on their name either in context of the client, or in context of the cluster, a cluster job is called only once and a client job is called for each client that the cluster holds.&#x20;

Cluster jobs should be named `job-name.cluster.ts`\
Client jobs should be named `job-name.client.ts`

## In practise

Scheduled jobs work like this:

```typescript
import { ScheduledJob } from './base'

const job = new ScheduledJob('a_scheduled_job', 1000, async () => {
  // do some work every second
})

job.start()

export default job
```

While regular jobs work like this:

```typescript
import { Job } from './base'

const job = new Job('a_job', async () => {
  // do some work
})

export default job

// elsewhere in the code:
import { jobs } from '../cache'
const job = jobs.get('a_job')

job?.run()
```
