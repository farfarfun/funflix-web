/** 枚举的中文标签与配色。后端返回的是英文字面值，展示层统一在这里翻译。 */

import {
  EarthOutline,
  FilmOutline,
  HelpCircleOutline,
  MicOutline,
  SparklesOutline,
  TvOutline,
} from '@vicons/ionicons5'
import type { Component } from 'vue'

import type { CheckStatus, MediaType, ParseStatus, Provider, Quality, SourceType } from '@/api/types'

type NTagType = 'default' | 'success' | 'info' | 'warning' | 'error'

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  movie: '电影',
  tv: '剧集',
  anime: '动漫',
  variety: '综艺',
  documentary: '纪录片',
  unknown: '未知',
}

/** 按作品类型给卡片/详情页一条强调色，扫一眼就能分辨电影/剧集/动漫……浅深色主题共用同一套，都是中高饱和度色，两边对比度都够。 */
export const MEDIA_TYPE_COLOR: Record<MediaType, string> = {
  movie: '#6d5ef8',
  tv: '#2b7fff',
  anime: '#e0529c',
  variety: '#d68f00',
  documentary: '#18a058',
  unknown: '#9095a3',
}

/** 没有封面图时，卡片/详情页拿它顶上去——总比空白或一格纯色好认。 */
export const MEDIA_TYPE_ICON: Record<MediaType, Component> = {
  movie: FilmOutline,
  tv: TvOutline,
  anime: SparklesOutline,
  variety: MicOutline,
  documentary: EarthOutline,
  unknown: HelpCircleOutline,
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  quark: '夸克',
  uc: 'UC',
  alipan: '阿里云盘',
  baidu: '百度网盘',
  pan115: '115',
  lanzou: '蓝奏云',
  tianyi: '天翼云盘',
  xunlei: '迅雷',
  magnet: '磁力',
  other: '其他',
}

/** 各网盘品牌色，贴近它们的实际视觉识别色，扫资源表时一眼分辨来源。 */
export const PROVIDER_COLOR: Record<Provider, string> = {
  quark: '#6d5ef8',
  uc: '#ff8a00',
  alipan: '#2b7fff',
  baidu: '#2468f2',
  pan115: '#00a3ff',
  lanzou: '#00c2a8',
  tianyi: '#d6336c',
  xunlei: '#2e8b57',
  magnet: '#9095a3',
  other: '#9095a3',
}

export const QUALITY_LABEL: Record<Quality, string> = {
  '4k': '4K',
  '1080p': '1080P',
  '720p': '720P',
  sd: '标清',
  unknown: '未知',
}

export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
  unchecked: '未校验',
  checking: '校验中',
  valid: '有效',
  invalid: '失效',
  need_password: '需提取码',
  rate_limited: '被限流',
  unsupported: '不支持校验',
  error: '校验出错',
}

export const CHECK_STATUS_TYPE: Record<CheckStatus, NTagType> = {
  unchecked: 'default',
  checking: 'info',
  valid: 'success',
  invalid: 'error',
  need_password: 'warning',
  rate_limited: 'warning',
  unsupported: 'default',
  error: 'error',
}

/** 与上面的语义类型一一对应的十六进制色，供进度条这类不能直接吃 n-tag type 的地方用。 */
export const CHECK_STATUS_COLOR: Record<CheckStatus, string> = {
  unchecked: '#9095a3',
  checking: '#2080f0',
  valid: '#18a058',
  invalid: '#d03050',
  need_password: '#f0a020',
  rate_limited: '#f0a020',
  unsupported: '#9095a3',
  error: '#d03050',
}

export const PARSE_STATUS_LABEL: Record<ParseStatus, string> = {
  pending: '待解析',
  running: '解析中',
  done: '已解析',
  failed: '解析失败',
  skipped: '已跳过',
}

export const PARSE_STATUS_TYPE: Record<ParseStatus, NTagType> = {
  pending: 'default',
  running: 'info',
  done: 'success',
  failed: 'error',
  skipped: 'warning',
}

export const PARSE_STATUS_COLOR: Record<ParseStatus, string> = {
  pending: '#9095a3',
  running: '#2080f0',
  done: '#18a058',
  failed: '#d03050',
  skipped: '#f0a020',
}

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  telegram: 'Telegram',
  tencent_docs: '腾讯智能表格',
  tencent_doc: '腾讯文档',
  weibo: '微博',
  forum: '论坛',
  rss: 'RSS',
  manual: '手工',
  api: 'API',
  unknown: '未知',
}

/** 枚举选项转成 naive-ui 的 options，并在最前面加一个「全部」。 */
export function toOptions<T extends string>(
  labels: Record<T, string>,
): { label: string; value: T }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ label: labels[value], value }))
}

export function formatSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function formatTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // 后端一律返回 UTC-aware 时间，这里按浏览器本地时区展示
  return d.toLocaleString('zh-CN', { hour12: false })
}

/** UUID 太长，列表窄列里放不下完整值。UUIDv7 前 48 位是时间戳，同批入库的行
 * 前几位几乎相同，取不到辨识度；末尾才是随机位，取末 8 位当短标识。 */
export function shortId(id: string): string {
  return id.slice(-8)
}

/** 相对时间，列表里比绝对时间好扫。 */
export function fromNow(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return iso
  const seconds = Math.round((Date.now() - d) / 1000)
  if (seconds < 0) return formatTime(iso)
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} 天前`
  return formatTime(iso)
}
