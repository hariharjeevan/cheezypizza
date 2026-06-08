import 'server-only'
import { getRestTurnCredentials, type IceServer } from './rest-turn'
import { getCoturnCredentials } from './coturn'

/**
 * Returns iceServers for the client using whichever TURN provider is configured.
 *
 * Provider selection (first match wins):
 *   1. REST TURN (Cloudflare, Metered, etc.) — set TURN_REST_URL
 *   2. coturn (self-hosted)                  — set COTURN_ENABLED
 *   3. None                                  — returns [] (STUN only)
 */
export async function getTurnIceServers(ttl: number): Promise<IceServer[]> {
  if (process.env.TURN_REST_URL) {
    return getRestTurnCredentials(ttl)
  }

  if (process.env.COTURN_ENABLED) {
    return getCoturnCredentials(ttl)
  }

  return []
}
