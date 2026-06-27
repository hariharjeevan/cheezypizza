// api/ice/route.ts

import { NextResponse } from 'next/server'
import { getTurnIceServers } from '../../../turn'

const stunServer = process.env.STUN_SERVER || 'stun:stun.l.google.com:19302'
const peerjsHost = process.env.PEERJS_HOST || '0.peerjs.com'
const peerjsPath = process.env.PEERJS_PATH || '/'
const fallbackHost = process.env.PEERJS_FALLBACK_HOST || ''
const fallbackPath = process.env.PEERJS_FALLBACK_PATH || '/peerjs'
const fallbackPort = parseInt(process.env.PEERJS_FALLBACK_PORT || '443')

const ICE_TTL = 86400 // 24 hours

export async function POST(): Promise<NextResponse> {
  try {
    const turnServers = await getTurnIceServers(ICE_TTL)
    return NextResponse.json({
      host: peerjsHost,
      path: peerjsPath,
      fallbackHost,
      fallbackPath,
      fallbackPort,
      iceServers: [{ urls: stunServer }, ...turnServers].slice(0, 4),
    })
  } catch (err) {
    console.error('[ICE] failed to get TURN credentials:', err)
    // Degrade gracefully to STUN-only rather than failing the whole peer init
    return NextResponse.json({
      host: peerjsHost,
      path: peerjsPath,
      fallbackHost,
      fallbackPath,
      fallbackPort,
      iceServers: [{ urls: stunServer }],
    })
  }
}
