import { createRequire } from 'node:module'

const pkg = createRequire(import.meta.url)('../../package.json') as {
  version: string
  homepage: string
  repository: { url: string }
}

/** Identifiable UA so API operators can contact us about traffic. */
export const USER_AGENT = [
  `WildBeast/${pkg.version}`,
  `(+${pkg.homepage}; +${pkg.repository.url.replace(/\.git$/, '')};)`,
].join(' ')

const REQUEST_TIMEOUT_MS = 10_000

async function request(
  url: string,
  accept: string,
  body?: unknown,
): Promise<Response> {
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: accept,
      'User-Agent': USER_AGENT,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return (await request(url, 'application/json', body)).json() as Promise<T>
}

export async function fetchText(url: string): Promise<string> {
  return (await request(url, 'text/plain')).text()
}
