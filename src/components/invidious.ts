import { Video, VideoSearchResult } from '../types/invidious'
import fetch from 'node-fetch'

export async function search (query: string): Promise<VideoSearchResult> {
  if (process.env.INVIDIOUS_HOST === undefined) throw new Error("Can't use Invidious methods without setting an API host")
  const response = await fetch(`${process.env.INVIDIOUS_HOST}/api/v1/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error(`Invidious API returned status code ${response.status}`)
  else return await response.json()
}

export async function getVideo (query: string): Promise<Video> {
  if (process.env.INVIDIOUS_HOST === undefined) throw new Error("Can't use Invidious methods without setting an API host")
  const response = await fetch(`${process.env.INVIDIOUS_HOST}/api/v1/videos/${query}`)
  if (!response.ok) throw new Error(`Invidious API returned status code ${response.status}`)
  else return await response.json()
}

export function authorImg (data: Video): string | undefined {
  if (data.authorThumbnails[0].url === undefined || data.authorThumbnails[0].url.length < 1) return undefined // this can happen sometimes
  else if (!data.authorThumbnails[0].url.startsWith('https:')) return `https:${data.authorThumbnails[0].url}`
  return data.authorThumbnails[0].url
}
