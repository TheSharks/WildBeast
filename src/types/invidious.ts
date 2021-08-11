/**
 * https://docs.invidious.io/API.md#get-apiv1videosid
 */
export interface Video {
  type: 'video'
  /**
   * The title of the video.
   */
  title: string
  /**
   * The ID of the video.
   */
  videoId: string
  /**
   * An array of the video's thumbnails.
   */
  videoThumbnails: Thumbnail[]
  /**
   * The video's description.
   */
  description: string
  /**
   * The video's description in HTML.
   */
  descriptionHtml: string
  /**
   * The unix timestamp of when the video was published.
   */
  published: number
  /**
   * The relative date of when the video was published.
   */
  publishedText: string
  /**
   * The video's keywords.
   */
  keywords: string[]
  /**
   * The amount of views the video has.
   */
  viewCount: number
  /**
   * The amount of likes the video has.
   */
  likeCount: number
  /**
   * The amount of dislikes the video has.
   */
  dislikeCount: number
  /**
   * Whether or not the video is considered paid.
   */
  paid: boolean
  /**
   * Whether or not the video is part of YouTube Premium.
   */
  premium: boolean
  /**
   * Whether or not the videos is considered family-friendly.
   */
  isFamilyFriendly: boolean
  /**
   * An array of ISO 3166 country codes that the video is available in.
   */
  allowedRegions: string[]
  /**
   * The video's genere.
   */
  genre: string
  /**
   * The URL of the associated genre.
   */
  genreUrl: string
  /**
   * The author of the video.
   */
  author: string
  /**
   * The ID of the author.
   */
  authorId: string
  /**
   * The URL of the author's profile.
   */
  authorUrl: string
  /**
   * The thumbnails for the author's profile.
   */
  authorThumbnails: Array<Omit<Thumbnail, 'quality'>>
  /**
   * How many subscribers the author has.
   * This is not an exact number, but rather an estimate.
   */
  subCountText: string
  /**
   * The length of the video in seconds.
   */
  lengthSeconds: number
  /**
   * Whether or not ratings are allowed for the video.
   */
  allowRatings: boolean
  /**
   * The median rating of the video.
   * This is a value between 0 and 5, where 0 is all dislikes, and 5 is all likes.
   */
  rating: number
  /**
   * Whether or not the video is listed on YouTube.
   */
  isListed: boolean
  /**
   * Whether or not the video is a live stream.
   */
  liveNow: boolean
  /**
   * Whether or not the video is upcoming.
   */
  isUpcoming: boolean
  /**
   * The Unix time of when this video will enter premiere.
   * Only filled when the video is in the "upcoming" state.
   */
  premiereTimestamp?: number
  /**
   * The HLS URL of the live stream.
   * Only filled when the video is a live stream.
   */
  hlsUrl?: string
  /**
   * The DASH formats of the video.
   */
  adaptiveFormats: AdaptiveFormat[]
  /**
   * The non-DASH formats of the video.
   */
  formatStreams: FormatStream[]
  /**
   * The captions of the video.
   */
  captions: Caption[]
  /**
   * The video's YouTube is recommending along with the video.
   */
  recommendedVideos: Array<Pick<Video, 'videoId' | 'title' | 'videoThumbnails' | 'author' | 'lengthSeconds' | 'viewCount'> & { viewCountText: string }>
}

export interface Thumbnail {
  /**
   * The URL of the thumbnail.
   */
  url: string
  /**
   * The width of the thumbnail.
   */
  width: number
  /**
   * The height of the thumbnail.
   */
  height: number
  /**
   * The assosiated quality profile of the thumbnail.
   */
  quality: string
}

export interface AdaptiveFormat {
  /**
   * The index of the format.
   */
  index: string
  /**
   * The bitrate of the format.
   */
  bitrate: string
  /**
   * The init of the format.
   */
  init: string
  /**
   * The URL of the format.
   * This is the URL that should be used to play the video in this format.
   */
  url: string
  /**
   * The ITAG of the format.
   */
  itag: string
  /**
   * The type of the format.
   */
  type: string
  clen: string // ??
  lmt: string // ??
  /**
   * The sort of projection this format is in.
   */
  projectionType: string
  /**
   * The file format of the video.
   */
  container: string
  /**
   * The codec of the video.
   */
  encoding: string
  /**
   * The assosiated quality label of the format.
   * Only filled when YouTube uses this format in the player's quality selection.
   */
  qualityLabel?: string
  /**
   * The assosiated resolution of the format.
   * Only filled when YouTube uses this format in the player's quality selection.
   */
  resolution?: string
}

export interface FormatStream {
  /**
   * The URL of the format.
   */
  url: string
  /**
   * The itag of the format.
   */
  itag: string
  /**
   * The type of the format.
   */
  type: string
  /**
   * The quality profile of the format.
   */
  quality: string
  /**
   * The file format of the video.
   */
  container: string
  /**
   * The codec of the video.
   */
  encoding: string
  /**
   * The quality label of the format.
   */
  qualityLabel: string
  /**
   * The resolution of the format.
   */
  resolution: string
  /**
   * The size of the format.
   */
  size: string
}

interface Caption {
  /**
   * The name of the caption as it appears in the player.
   */
  label: string
  /**
   * The ISO 3166 country code of the caption.
   */
  languageCode: string
  /**
   * The API URL of the caption.
   */
  url: string
}

export type VideoSearchResult = Array<Pick<Video,
'type' |
'title' |
'videoId' |
'author' |
'authorId' |
'authorUrl' |
'videoThumbnails' |
'description' |
'descriptionHtml' |
'viewCount' |
'published' |
'publishedText' |
'lengthSeconds' |
'liveNow' |
'paid' |
'premium'
>>
