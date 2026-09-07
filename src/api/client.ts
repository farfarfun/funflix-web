/** 后端接口调用。用原生 fetch，不引第三方 HTTP 库。 */

import type {
  AuthConfig,
  CollectReport,
  MediaDetail,
  MediaSummary,
  Page,
  ParseReport,
  PipelineStats,
  RawDocument,
  RawDocumentSummary,
  Resource,
  Source,
  User,
} from './types'

const BASE = '/api/v1'

/** 后端返回的错误。保留状态码，调用方可据此区分 404 与 500。 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type Params = Record<string, string | number | boolean | null | undefined>

function query(params?: Params): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    // 空串也要跳过：keyword='' 传上去会被后端当成有关键词处理
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/**
 * 401 时要清掉本地镜像的登录态（例如会话过期），但这里不能直接 import
 * `./auth`——auth.ts 反过来要引这个文件的 `api`，会形成循环依赖。
 * 用回调注册的方式解耦：谁关心 401 谁自己订阅。
 */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}

async function request<T>(path: string, init?: RequestInit & { params?: Params }): Promise<T> {
  const { params, ...rest } = init ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> | undefined),
  }

  // 「运维」区整体走会话 cookie 鉴权，同源请求默认就会带上，这里显式声明
  // 只是为了不依赖浏览器的默认值。
  const resp = await fetch(`${BASE}${path}${query(params)}`, {
    ...rest,
    headers,
    credentials: 'same-origin',
  })

  if (!resp.ok) {
    // FastAPI 的报错在 detail 里；它可能是字符串，也可能是校验错误数组
    let detail = `请求失败（HTTP ${resp.status}）`
    try {
      const body = await resp.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail)) {
        detail = body.detail.map((e: { msg?: string }) => e.msg ?? '参数错误').join('；')
      }
    } catch {
      // 响应不是 JSON（网关错误页等），保留上面的兜底文案
    }
    if (resp.status === 401) onUnauthorized?.()
    throw new ApiError(resp.status, detail)
  }

  if (resp.status === 204) return undefined as T
  return (await resp.json()) as T
}

export interface MediaQuery extends Params {
  keyword?: string
  media_type?: string | null
  year?: number | null
  valid_only?: boolean
  provider?: string | null
  page?: number
  size?: number
}

export const api = {
  // --- 账号 ---
  authConfig: () => request<AuthConfig>('/auth/config'),
  me: () => request<User | null>('/auth/me'),
  login: (username: string, password: string) =>
    request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  register: (username: string, password: string) =>
    request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // --- 作品 ---
  listMedia: (params: MediaQuery) => request<Page<MediaSummary>>('/media', { params }),
  getMedia: (id: string) => request<MediaDetail>(`/media/${id}`),

  // --- 资源 ---
  listResources: (params: Params) => request<Page<Resource>>('/resources', { params }),

  // --- 统计 ---
  getStats: () => request<PipelineStats>('/stats'),

  // --- 采集源 ---
  listSources: (params?: Params) => request<Page<Source>>('/sources', { params }),
  supportedSourceTypes: () => request<string[]>('/sources/supported'),
  createSource: (payload: Record<string, unknown>) =>
    request<Source>('/sources', { method: 'POST', body: JSON.stringify(payload) }),
  updateSource: (id: string, payload: Record<string, unknown>) =>
    request<Source>(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSource: (id: string) => request<void>(`/sources/${id}`, { method: 'DELETE' }),
  collectSource: (id: string) =>
    request<CollectReport>(`/sources/${id}/collect`, { method: 'POST' }),
  parseSource: (id: string) => request<ParseReport>(`/sources/${id}/parse`, { method: 'POST' }),

  // --- 原始文本 ---
  listRaw: (params: Params) => request<Page<RawDocumentSummary>>('/raw', { params }),
  getRaw: (id: string) => request<RawDocument>(`/raw/${id}`),
  createRaw: (payload: Record<string, unknown>) =>
    request<unknown>('/raw', { method: 'POST', body: JSON.stringify(payload) }),
}
