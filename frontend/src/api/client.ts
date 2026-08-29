/** 后端接口调用。用原生 fetch，不引第三方 HTTP 库。 */

import { adminKey } from './auth'
import type {
  CollectReport,
  MediaDetail,
  MediaSummary,
  Page,
  PipelineStats,
  RawDocument,
  RawDocumentSummary,
  Resource,
  Source,
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

async function request<T>(path: string, init?: RequestInit & { params?: Params }): Promise<T> {
  const { params, ...rest } = init ?? {}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string> | undefined),
  }
  // 读接口带上也无妨，后端只在写接口上校验
  if (adminKey.value) headers['X-API-Key'] = adminKey.value

  const resp = await fetch(`${BASE}${path}${query(params)}`, { ...rest, headers })

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
    if (resp.status === 401) detail = '管理密钥无效，请在左下角「管理密钥」里更新'
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
  page?: number
  size?: number
}

export const api = {
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

  // --- 原始文本 ---
  listRaw: (params: Params) => request<Page<RawDocumentSummary>>('/raw', { params }),
  getRaw: (id: string) => request<RawDocument>(`/raw/${id}`),
  createRaw: (payload: Record<string, unknown>) =>
    request<unknown>('/raw', { method: 'POST', body: JSON.stringify(payload) }),
}
