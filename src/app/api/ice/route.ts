// api/ice/route.ts

import { NextResponse } from 'next/server'
import { getTurnIceServers } from '../../../turn'

const stunServer = process.env.STUN_SERVER || 'stun:stun.l.google.com:19302'
const peerjsHost = process.env.PEERJS_HOST || '0.peerjs.com'
const peerjsPath = process.env.PEERJS_PATH || '/'

const ICE_TTL = 86400 // 24 hours

export async function POST(): Promise<NextResponse> {
  try {
    const turnServers = await getTurnIceServers(ICE_TTL)
    return NextResponse.json({
      host: peerjsHost,
      path: peerjsPath,
      iceServers: [{ urls: stunServer }, ...turnServers].slice(0, 4),
    })
  } catch (err) {
    console.error('[ICE] failed to get TURN credentials:', err)
    // Degrade gracefully to STUN-only rather than failing the whole peer init
    return NextResponse.json({
      host: peerjsHost,
      path: peerjsPath,
      iceServers: [{ urls: stunServer }],
    })
  }
}
