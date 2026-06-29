// POST /api/stats/record-local
// Increments local (WebRTC) bytes transferred and transfer count.
// Called by useLocalDownloader() once all files are received.

import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '../../../../redisClient'

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
      redis.incrby('stats:local:bytes:total', Math.floor(bytes)),
      redis.incr('stats:local:transfers:total'),
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
