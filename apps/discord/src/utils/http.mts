import { createRequire } from 'node:module'

const { version } = createRequire(import.meta.url)('../../package.json') as {
  version: string
}

export const USER_AGENT = `wildbeast/${version} (+https://wildbeast.guide)`

const REQUEST_TIMEOUT_MS = 10_000

async function request(url: string, accept: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`${url} responded with ${response.status}`)
  }
  return response
}

export async function fetchJson<T>(url: string): Promise<T> {
  return (await request(url, 'application/json')).json() as Promise<T>
}

export async function fetchText(url: string): Promise<string> {
  return (await request(url, 'text/plain')).text()
}
