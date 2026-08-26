/** 枚举的中文标签与配色。后端返回的是英文字面值，展示层统一在这里翻译。 */

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
