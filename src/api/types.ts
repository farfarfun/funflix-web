/** 与后端 schemas 一一对应的出入参类型。 */

export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
}

/**
 * `book` / `comic` / `other` 是**非影视**类型 —— 采集源里混着大量小说、漫画、
 * 课程的分享，它们是真资源，但搜「大主宰」的人要的是那部动漫。所以后端默认
 * 不把它们放进结果，必须显式传 `media_type` 才看得到（见后端
 * `services/search.py` 的 `VIDEO_MEDIA_TYPES`）。
 *
 * `unknown` 不在此列：它是「还没判出类型」而不是「不是影视」，默认可见。
 */
export type MediaType =
  | 'movie'
  | 'tv'
  | 'anime'
  | 'variety'
  | 'documentary'
  | 'unknown'
  | 'book'
  | 'comic'
  | 'other'

export type Quality = '4k' | '1080p' | '720p' | 'sd' | 'unknown'

export type Provider =
  | 'quark'
  | 'uc'
  | 'alipan'
  | 'baidu'
  | 'pan115'
  | 'pan123'
  | 'mobile139'
  | 'guangya'
  | 'ctfile'
  | 'lanzou'
  | 'tianyi'
  | 'xunlei'
  | 'magnet'
  | 'ed2k'
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
  | 'kdocs'
  | 'weibo'
  | 'forum'
  | 'web'
  | 'rss'
  | 'manual'
  | 'api'
  | 'unknown'

export interface Tag {
  id: string
  kind: 'genre' | 'region' | 'language' | 'year' | 'other'
  name: string
}

export interface Resource {
  id: string
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

export interface ProviderVerifyReport {
  provider: Provider
  claimed: number
  succeeded: number
  failed: number
  reclaimed: number
  abandoned: number
}

export interface MediaSummary {
  id: string
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

/**
 * 作品详情里的一季。
 *
 * `season` 为 0 表示「无季概念」（电影、单季剧、综艺），展示时该渲染成
 * 「正片」而不是「第 0 季」—— 用 `seasonLabel()`。
 */
export interface SeasonSummary extends MediaSummary {
  season: number
}

export interface SeasonDetail extends SeasonSummary {
  /** **可能是截断的**（后端每季最多返回 50 条），真实总数看 `resource_count` */
  resources: Resource[]
}

/**
 * 搜索结果的一行 —— 一部剧，不是一季。
 *
 * 搜「大主宰」给的是一条「大主宰（4 季 / 1496 资源）」，而不是 448 条同名行。
 * 季数与资源数是跨季汇总后的冗余计数，列表页直接用，不要自己去数 `seasons`。
 */
export interface WorkSummary {
  id: string
  title: string
  original_title: string | null
  media_type: MediaType
  /** 后端已把「年份未知」的哨兵 0 抹成 null */
  year: number | null
  poster_url: string | null
  season_count: number
  resource_count: number
  valid_resource_count: number
}

export interface WorkDetail extends WorkSummary {
  norm_key: string
  aliases: string[]
  overview: string | null
  tmdb_id: number | null
  douban_id: string | null
  imdb_id: string | null
  created_at: string
  updated_at: string
  /** 各季标签去重后的并集 —— 题材/地区描述的是整部剧 */
  tags: Tag[]
  seasons: SeasonDetail[]
}

export interface Source {
  id: string
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
  raw_total: number
  raw_parsed: number
  resource_total: number
  created_at: string
  updated_at: string
}

export interface CollectReport {
  source_id: string
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

export interface ParseReport {
  source_id: string
  claimed: number
  succeeded: number
  failed: number
  reclaimed: number
  abandoned: number
  remaining_pending: number
}

export interface RawDocumentSummary {
  id: string
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

export interface User {
  id: string
  username: string
  /**
   * `admin` 才看得到「运维」入口。这只是省掉一次无意义的点击 —— 真正的拦截在
   * 后端（`AdminUserDep`），在控制台里把这个字段改成 admin 也进不去运维接口。
   */
  role: 'admin' | 'guest'
}

export interface AuthConfig {
  registration_enabled: boolean
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
  resource_by_provider_check: Record<string, Record<string, number>>
  resource_orphan: number
  media_resource_total: number
  check_total: number
}
