/// <reference types="node" />
import { BlockList, isIP } from 'node:net'
import { RenderError } from '../runtime/errors.js'
import { renderSegment } from '../runtime/renderer.js'
import type { LazyTagHandler, RenderContext } from '../types.js'

// SSRF blocklist: loopback/private/link-local/metadata; BlockList handles IPv4-mapped IPv6.
const blockedRanges = new BlockList()
blockedRanges.addSubnet('0.0.0.0', 8, 'ipv4')
blockedRanges.addSubnet('10.0.0.0', 8, 'ipv4')
blockedRanges.addSubnet('100.64.0.0', 10, 'ipv4')
blockedRanges.addSubnet('127.0.0.0', 8, 'ipv4')
blockedRanges.addSubnet('169.254.0.0', 16, 'ipv4')
blockedRanges.addSubnet('172.16.0.0', 12, 'ipv4')
blockedRanges.addSubnet('192.168.0.0', 16, 'ipv4')
blockedRanges.addAddress('::1', 'ipv6')
blockedRanges.addSubnet('fe80::', 10, 'ipv6')
blockedRanges.addSubnet('fc00::', 7, 'ipv6')

const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

const ALLOWED_VERBS = new Set([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
])

function normalizeHostname(host: string): string {
  return host.toLowerCase().replace(/\.+$/, '')
}

function assertUrlAllowed(raw: string, allowedHosts?: string[]): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new RenderError(`Invalid fetch URL: ${raw}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RenderError(`Blocked fetch URL scheme: ${url.protocol}`)
  }

  // Reject userinfo to fail closed on credential smuggling/host confusion.
  if (url.username || url.password) {
    throw new RenderError('Blocked fetch URL with credentials')
  }

  const hostname = normalizeHostname(url.hostname)

  // Allowlist still subject to blocklist below.
  if (allowedHosts) {
    const normalizedAllowed = allowedHosts.map((host) =>
      normalizeHostname(host),
    )
    if (!normalizedAllowed.includes(hostname)) {
      throw new RenderError(`Fetch host not in allowlist: ${hostname}`)
    }
  }

  // SSRF: localhost always loopback (trailing dot already stripped).
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new RenderError(`Blocked fetch to private host: ${hostname}`)
  }

  // IPv6 literals arrive bracketed.
  const literal =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname
  const family = isIP(literal)
  if (family === 4 && blockedRanges.check(literal, 'ipv4')) {
    throw new RenderError(`Blocked fetch to private address: ${literal}`)
  }
  if (family === 6 && blockedRanges.check(literal, 'ipv6')) {
    throw new RenderError(`Blocked fetch to private address: ${literal}`)
  }

  // SSRF note: hostnames aren't DNS-pinned here; use fetchAllowedHosts for untrusted templates.
  return url
}

async function readCapped(
  response: Response,
  maxLength: number,
): Promise<string> {
  const body = response.body
  if (!body) {
    return ''
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let result = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      result += decoder.decode(value, { stream: true })
      if (result.length > maxLength) {
        throw new RenderError(
          `Fetch response exceeded maximum length of ${maxLength} characters`,
        )
      }
    }
  } finally {
    // Release connection; ignore cancel errors.
    await reader.cancel().catch(() => undefined)
  }
  result += decoder.decode()
  return result
}

export const fetchHandler: LazyTagHandler = async (
  ctx: RenderContext,
  args,
  limits,
  depth = 0,
) => {
  if (!ctx.options.enableFetch) {
    throw new RenderError('Fetch tag is disabled in the current context')
  }

  const [urlArg, verbArg] = args

  const url = urlArg
    ? await renderSegment(urlArg, ctx, '', limits, depth + 1)
    : ''
  const verb = verbArg
    ? await renderSegment(verbArg, ctx, '', limits, depth + 1)
    : 'GET'

  const target = assertUrlAllowed(url, ctx.options.fetchAllowedHosts)

  if (ctx.fetchRequests >= limits.maxFetchRequests) {
    throw new RenderError(
      `Exceeded maximum fetch requests of ${limits.maxFetchRequests}`,
    )
  }

  ctx.fetchRequests++

  const callerOptions = ctx.options.fetchOptions ?? {}
  // Headers normalizes all HeadersInit forms; default UA survives unless overridden.
  const headers = new Headers(callerOptions.headers)
  if (!headers.has('user-agent')) {
    headers.set(
      'User-Agent',
      '@TheSharks/TagScript/1.0 #github.com/TheSharks/WildBeast',
    )
  }
  // Single timeout caps whole redirect chain.
  const signal = callerOptions.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS)

  // Manual redirects so every hop revalidates SSRF/allowlist rules.
  let currentUrl = target
  // Unknown verbs fall back to GET to block smuggled methods.
  const normalizedVerb = verb.trim().toUpperCase()
  let method =
    normalizedVerb && ALLOWED_VERBS.has(normalizedVerb) ? normalizedVerb : 'GET'
  let response: Response

  for (let hop = 0; ; hop++) {
    // Embedder options may override method; redirect handling stays manual.
    try {
      response = await fetch(currentUrl, {
        method,
        ...callerOptions,
        headers,
        signal,
        redirect: 'manual',
      })
    } catch (error) {
      throw new RenderError(
        `Fetch request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    if (!REDIRECT_STATUSES.has(response.status)) {
      break
    }

    await response.body?.cancel().catch(() => undefined)

    if (hop >= MAX_REDIRECTS) {
      throw new RenderError(
        `Fetch exceeded maximum of ${MAX_REDIRECTS} redirects`,
      )
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new RenderError(
        `Fetch request failed with status ${response.status}`,
      )
    }

    let resolved: URL
    try {
      resolved = new URL(location, currentUrl)
    } catch {
      throw new RenderError(`Invalid fetch redirect URL: ${location}`)
    }
    currentUrl = assertUrlAllowed(resolved.href, ctx.options.fetchAllowedHosts)

    // Redirect hops count against the same fetch budget.
    if (ctx.fetchRequests >= limits.maxFetchRequests) {
      throw new RenderError(
        `Exceeded maximum fetch requests of ${limits.maxFetchRequests}`,
      )
    }
    ctx.fetchRequests++

    // 303 always becomes GET; 301/302 POSTs match browser behavior.
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) &&
        method === 'POST')
    ) {
      method = 'GET'
    }
  }

  if (!response.ok) {
    throw new RenderError(`Fetch request failed with status ${response.status}`)
  }

  return await readCapped(response, limits.maxOutputLength)
}
