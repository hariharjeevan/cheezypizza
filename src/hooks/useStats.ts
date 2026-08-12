'use client'
import { useEffect, useState } from 'react'

export type Stats = {
  totalPageviews: number
  monthPageviews: number
  totalBytes: number
  totalTransfers: number
  localBytes: number
  localTransfers: number
}

const PING_CACHE_KEY = 'stats:pinged:'
const STATS_CACHE_KEY = 'stats:payload'

export function getStatsPingCacheKey(): string {
  return `${PING_CACHE_KEY}${new Date().toISOString().slice(0, 10)}`
}

export function shouldSkipStatsPing(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(getStatsPingCacheKey()) === '1'
}

function readStoredStats(): Stats | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(STATS_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as {
      timestamp?: number
      data?: Stats
    } | null
    if (!parsed?.data || typeof parsed.timestamp !== 'number') return null

    const age = Date.now() - parsed.timestamp
    if (age > CACHE_TTL) {
      sessionStorage.removeItem(STATS_CACHE_KEY)
      return null
    }

    return parsed.data
  } catch {
    sessionStorage.removeItem(STATS_CACHE_KEY)
    return null
  }
}

function writeStoredStats(data: Stats): void {
  if (typeof window === 'undefined') return

  sessionStorage.setItem(
    STATS_CACHE_KEY,
    JSON.stringify({
      timestamp: Date.now(),
      data,
    }),
  )
}

function getOrCreateVisitorId(): string {
  const KEY = '_cpvid'
  let vid = localStorage.getItem(KEY)
  if (!vid) {
    vid = crypto.randomUUID()
    localStorage.setItem(KEY, vid)
  }
  return vid
}

// Module-level singleton: one fetch per page load, shared across all callers.
let _cache: Stats | null = null
let _promise: Promise<Stats> | null = null
let _fetchedAt: number = 0
const CACHE_TTL = 30 * 60 * 1000

function fetchStats(): Promise<Stats> {
  const storedStats = readStoredStats()
  if (storedStats) {
    _cache = storedStats
    _fetchedAt = Date.now()
    return Promise.resolve(storedStats)
  }

  if (_promise && Date.now() - _fetchedAt < CACHE_TTL) return _promise
  _promise = null

  const shouldSkipPing = shouldSkipStatsPing()
  const vid = getOrCreateVisitorId()

  const pingRequest = shouldSkipPing
    ? Promise.resolve()
    : fetch('/api/stats/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vid }),
      })
        .then(() => {
          sessionStorage.setItem(getStatsPingCacheKey(), '1')
        })
        .catch(() => {})

  _promise = pingRequest
    .then(() => fetch('/api/stats'))
    .then((r) => r.json())
    .then((data: Stats) => {
      _cache = data
      _fetchedAt = Date.now()
      writeStoredStats(data)
      return data
    })
    .catch(() => {
      _promise = null // allow retry on error
      return null as unknown as Stats
    })
  return _promise
}

export function useStats(): Stats | null {
  const [stats, setStats] = useState<Stats | null>(_cache)
  useEffect(() => {
    if (_cache && Date.now() - _fetchedAt < CACHE_TTL) return
    fetchStats().then((data) => {
      if (data) setStats(data)
    })
  }, [])
  return stats
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e15) return `${(bytes / 1e15).toFixed(2)} PB`
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${bytes} B`
}

export function formatBytesSubUnit(bytes: number): string | null {
  if (bytes >= 1e15) return `${(bytes / 1e12).toFixed(0)} TB`
  if (bytes >= 1e12) return `${(bytes / 1e9).toFixed(0)} GB`
  if (bytes >= 1e9) return `${(bytes / 1e6).toFixed(0)} MB`
  if (bytes >= 1e6) return `${(bytes / 1e3).toFixed(0)} KB`
  return null
}
