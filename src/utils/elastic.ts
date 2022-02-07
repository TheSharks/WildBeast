import { Client } from '@elastic/elasticsearch'
import { BulkStats } from '@elastic/elasticsearch/lib/Helpers'
import { format } from 'date-fns'
import discord from '../structures/client'
import { debug, trace, warn } from './logger'

const storage = new Set()

export function add (data: any): number {
  data['@timestamp'] = new Date().toISOString()
  storage.add(data)
  return storage.size
}

export function drop (): number {
  storage.clear()
  return storage.size
}

export async function * drain (): AsyncGenerator<any> {
  for (const data of storage) {
    storage.delete(data)
    yield data
  }
}

export async function flush (): Promise<BulkStats> {
  if (process.env.ELASTIC_URL === undefined) throw new Error('Trying to flush to Elasticsearch, but no URL is set.')
  debug('Flushing elasticsearch', 'Elastic')
  const client = new Client({
    node: process.env.ELASTIC_URL,
    // auth can be either be a b64 encoded api key, or basic auth incorporated into the URL
    ...(process.env.ELASTIC_API_KEY !== undefined
      ? {
          auth: {
            apiKey: process.env.ELASTIC_API_KEY
          }
        }
      : {})
  })
  const result = await client.helpers.bulk({
    datasource: drain(),
    onDocument (doc) {
      return {
        create: {
          _index: `wildbeast-${discord.client.applicationId}-${format(new Date(), 'yyyy-MM-dd')}`
        }
      }
    }
  })
  debug(`Flushed ${result.successful} analytics documents to Elastic, ${result.failed} failed`, 'Elastic')
  trace(result, 'Elastic')
  if (result.failed > 0) {
    warn(`Failed to flush ${result.failed} analytics documents to Elastic`, 'Elastic')
  }
  // Persistent connection to elastic isn't necessary, close it
  // we recreate the client on the next flush anyway
  await client.close()
  return result
}
