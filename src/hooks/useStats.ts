'use client'

import { useEffect, useState } from 'react'

export type Stats = {
  totalPageviews: number
  monthPageviews: number
  totalBytes: number
  totalTransfers: number
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

export function useStats(): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const vid = getOrCreateVisitorId()

    // Fire ping then fetch stats so the count reflects the current visit
    fetch('/api/stats/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vid }),
    })
      .catch(() => {})
      .finally(() => {
        fetch('/api/stats')
          .then((r) => r.json())
          .then((data: Stats) => setStats(data))
          .catch(() => {})
      })
  }, [])

  return stats
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${bytes} B`
}
