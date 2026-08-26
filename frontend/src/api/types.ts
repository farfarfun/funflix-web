/** 与后端 schemas 一一对应的出入参类型。 */

export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export type MediaType = 'movie' | 'tv' | 'anime' | 'variety' | 'documentary' | 'unknown'

export type Quality = '4k' | '1080p' | '720p' | 'sd' | 'unknown'

export type Provider =
  | 'quark'
  | 'uc'
  | 'alipan'
  | 'baidu'
  | 'pan115'
  | 'lanzou'
  | 'tianyi'
  | 'xunlei'
  | 'magnet'
  | 'other'

export type CheckStatus =
  | 'unchecked'
  | 'checking'
  | 'valid'
  | 'invalid'
  | 'need_password'
  | 'rate_limited'
  | 'unsupported'
  | 'error'

export type ParseStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export type SourceType =
  | 'telegram'
  | 'tencent_docs'
  | 'tencent_doc'
  | 'weibo'
  | 'forum'
  | 'rss'
  | 'manual'
  | 'api'
  | 'unknown'

export interface Tag {
  id: number
  kind: 'genre' | 'region' | 'language' | 'year' | 'other'
  name: string
}

export interface Resource {
  id: number
  provider: Provider
  url: string
  passcode: string | null
  title_raw: string | null
  quality: Quality
  episode_info: string | null
  size_bytes: number | null
  check_status: CheckStatus
  last_checked_at: string | null
  first_seen_at: string
  last_seen_at: string
  seen_count: number
}

export interface MediaSummary {
  id: number
  title: string
  original_title: string | null
  media_type: MediaType
  /** 后端已把「年份未知」的哨兵 0 抹成 null */
  year: number | null
  poster_url: string | null
  resource_count: number
  valid_resource_count: number
}

export interface MediaDetail extends MediaSummary {
  norm_key: string
  aliases: string[]
  overview: string | null
  tmdb_id: number | null
  douban_id: string | null
  imdb_id: string | null
  created_at: string
  updated_at: string
  tags: Tag[]
  resources: Resource[]
}

export interface Source {
  id: number
  source_type: SourceType
  url: string
  identifier: string
  title: string | null
  enabled: boolean
  fetch_interval_seconds: number
  max_pages_per_fetch: number
  cursor_message_id: string | null
  cursor_published_at: string | null
  last_fetched_at: string | null
  last_success_at: string | null
  next_fetch_at: string | null
  consecutive_failures: number
  last_error: string | null
  total_collected: number
  created_at: string
  updated_at: string
}

export interface CollectReport {
  source_id: number
  ok: boolean
  fetched: number
  created: number
  duplicated: number
  skipped_empty: number
  pages_fetched: number
  truncated: boolean
  cursor_before: string | null
  cursor_after: string | null
  error: string | null
}

export interface RawDocumentSummary {
  id: number
  content_hash: string
  source_type: SourceType
  source_name: string | null
  collected_at: string
  parse_status: ParseStatus
  parse_attempts: number
}

export interface RawDocument extends RawDocumentSummary {
  content: string
  source_url: string | null
  source_msg_id: string | null
  published_at: string | null
  extra: Record<string, unknown>
  parse_error: string | null
  created_at: string
  updated_at: string
}

export interface PipelineStats {
  sources_total: number
  sources_enabled: number
  sources_failing: number
  raw_total: number
  raw_by_status: Record<string, number>
  extraction_total: number
  extraction_by_model: Record<string, number>
  media_total: number
  media_by_type: Record<string, number>
  resource_total: number
  resource_by_check: Record<string, number>
  resource_by_provider: Record<string, number>
  resource_orphan: number
  media_resource_total: number
  check_total: number
}
