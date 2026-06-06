// GET /api/stats
// Returns all counters for homepage display.
// Called once on homepage mount by useStats().

import { NextResponse } from 'next/server'
import { getRedisClient } from '../../../redisClient'

export async function GET(): Promise<NextResponse> {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return NextResponse.json({
        totalPageviews: 0,
        monthPageviews: 0,
        totalBytes: 0,
        totalTransfers: 0,
      })
    }

    const monthKey = `stats:pageviews:${new Date().toISOString().slice(0, 7)}`
    const [totalViews, monthViews, totalBytes, totalTransfers] =
      await Promise.all([
        redis.get('stats:pageviews:total'),
        redis.get(monthKey),
        redis.get('stats:bytes:total'),
        redis.get('stats:transfers:total'),
      ])
    return NextResponse.json({
      totalPageviews: parseInt(totalViews ?? '0'),
      monthPageviews: parseInt(monthViews ?? '0'),
      totalBytes: parseInt(totalBytes ?? '0'),
      totalTransfers: parseInt(totalTransfers ?? '0'),
    })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
