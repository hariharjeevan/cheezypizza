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
  if (_promise && Date.now() - _fetchedAt < CACHE_TTL) return _promise
  _promise = null
  const vid = getOrCreateVisitorId()
  _promise = fetch('/api/stats/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vid }),
  })
    .catch(() => {})
    .then(() => fetch('/api/stats'))
    .then((r) => r.json())
    .then((data: Stats) => {
      _cache = data
      _fetchedAt = Date.now()
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
