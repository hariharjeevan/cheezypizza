// POST /api/stats/ping
// Counts a unique page visit, deduped per visitor per day.
// Receives a { vid } from the client — a localStorage UUID.
// The UUID is never stored; only a daily HMAC hash of it is kept in Redis (TTL 24h).
// Called once on homepage mount by useStats().

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getRedisClient } from '../../../../redisClient'

// Set PAGEVIEW_SALT in .env.local — generate with: openssl rand -hex 32
const SALT = process.env.PAGEVIEW_SALT ?? 'dev'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const vid = body?.vid

    if (typeof vid !== 'string' || vid.length < 8 || vid.length > 128) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10) // "2026-06-06"
    const month = today.slice(0, 7) // "2026-06"

    // Hash rotates daily — vid never stored in Redis
    const hash = createHmac('sha256', SALT)
      .update(vid + today)
      .digest('hex')

    const dedupKey = `stats:seen:${hash}`
    const redis = getRedisClient()
    if (!redis) {
      return NextResponse.json({ ok: true })
    }

    const alreadySeen = await redis.exists(dedupKey)
    if (!alreadySeen) {
      const monthKey = `stats:pageviews:${month}`
      await Promise.all([
        redis.incr('stats:pageviews:total'),
        redis.incr(monthKey),
        redis.expire(monthKey, 60 * 60 * 24 * 90), // 90d TTL — auto-expire old months
        redis.setex(dedupKey, 60 * 60 * 24, '1'), // dedup key expires after 24h
      ])
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
