// POST /api/stats/record
// Increments total bytes transferred and total transfer count.
// Called by useDownloader() once isDone becomes true (transfer complete).

import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '../../../../redisClient'

// 100 GB sanity cap per transfer — rejects spoofed/absurd values
const MAX_BYTES_PER_TRANSFER = 100 * 1024 ** 3

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json()
    const bytes = body?.bytes

    if (
      typeof bytes !== 'number' ||
      bytes <= 0 ||
      bytes > MAX_BYTES_PER_TRANSFER
    ) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const redis = getRedisClient()
    if (!redis) {
      return NextResponse.json({ ok: true })
    }

    await Promise.all([
      redis.incrby('stats:bytes:total', Math.floor(bytes)),
      redis.incr('stats:transfers:total'),
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
