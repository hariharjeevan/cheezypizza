import 'server-only'

export type IceServer = {
  urls: string | string[]
  username?: string
  credential?: string
}

/**
 * REST TURN provider — works with any service that returns an
 * iceServers array from a GET or POST endpoint.
 *
 * Cloudflare:  POST https://rtc.live.cloudflare.com/v1/turn/keys/$KEY_ID/credentials/generate-ice-servers
 * Metered:     GET  https://$APP.metered.live/api/v1/turn/credentials?apiKey=$API_KEY
 * Any other:   set TURN_REST_URL + optionally TURN_REST_METHOD and TURN_REST_TOKEN
 *
 * Env vars:
 *   TURN_REST_URL     — full endpoint URL (required)
 *   TURN_REST_TOKEN   — passed as Bearer token in Authorization header (optional)
 *   TURN_REST_METHOD  — GET or POST (default: GET)
 *   TURN_REST_BODY    — raw JSON body string for POST requests (optional)
 */
export async function getRestTurnCredentials(
  ttl: number,
): Promise<IceServer[]> {
  const url = process.env.TURN_REST_URL
  if (!url) {
    throw new Error('TURN_REST_URL must be set')
  }

  const method = (process.env.TURN_REST_METHOD || 'GET').toUpperCase()
  const token = process.env.TURN_REST_TOKEN
  const rawBody = process.env.TURN_REST_BODY

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(method === 'POST' ? { body: rawBody ?? JSON.stringify({ ttl }) } : {}),
  })

  if (!res.ok) {
    throw new Error(`TURN REST API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  // Cloudflare wraps in { iceServers: [...] }, Metered returns the array directly
  return Array.isArray(data) ? data : (data.iceServers as IceServer[])
}
