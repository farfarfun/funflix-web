import { describe, expect, it } from 'vitest'
import { formatSize, formatTime, fromNow, shortId, toOptions } from './display'

describe('formatSize', () => {
  it('null 或非正数返回占位符', () => {
    expect(formatSize(null)).toBe('-')
    expect(formatSize(0)).toBe('-')
    expect(formatSize(-1)).toBe('-')
  })

  it('按 1024 进制换算单位', () => {
    expect(formatSize(500)).toBe('500 B')
    expect(formatSize(2048)).toBe('2.0 KB')
    expect(formatSize(1024 * 1024 * 1.5)).toBe('1.5 MB')
  })
})

describe('shortId', () => {
  it('取末 8 位作为短标识', () => {
    expect(shortId('0192b1a2-aaaa-bbbb-cccc-0123456789ab')).toBe('456789ab')
  })
})

describe('formatTime / fromNow', () => {
  it('空值返回占位符', () => {
    expect(formatTime(null)).toBe('-')
    expect(fromNow(null)).toBe('-')
  })

  it('非法时间字符串原样返回', () => {
    expect(formatTime('not-a-date')).toBe('not-a-date')
    expect(fromNow('not-a-date')).toBe('not-a-date')
  })

  it('fromNow 对刚发生的时间返回"刚刚"', () => {
    expect(fromNow(new Date().toISOString())).toBe('刚刚')
  })
})

describe('toOptions', () => {
  it('把标签字典转成 naive-ui 的 options 列表', () => {
    const labels = { a: 'A', b: 'B' } as const
    expect(toOptions(labels)).toEqual([
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ])
  })
})
