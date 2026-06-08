import 'server-only'
import crypto from 'crypto'
import { getRedisClient } from './redisClient'
import type { IceServer } from './rest-turn'

function generateHMACKey(
  username: string,
  realm: string,
  password: string,
): string {
  const str = `${username}:${realm}:${password}`
  return crypto.createHash('md5').update(str).digest('hex')
}

export async function setTurnCredentials(
  username: string,
  password: string,
  ttl: number,
): Promise<void> {
  const realm = process.env.TURN_REALM || 'file.pizza'

  const redis = getRedisClient()
  if (!redis) {
    throw new Error('Redis is not configured')
  }

  const hmacKey = generateHMACKey(username, realm, password)
  const key = `turn/realm/${realm}/user/${username}/key`

  await redis.setex(key, ttl, hmacKey)
}

/**
 * Generates ephemeral credentials, stores them in Redis for coturn,
 * and returns iceServers config for the client.
 * Requires: COTURN_ENABLED, REDIS_URL, TURN_REALM (optional), TURN_HOST (optional)
 */
export async function getCoturnCredentials(ttl: number): Promise<IceServer[]> {
  const host = process.env.TURN_HOST || process.env.TURN_REALM || '127.0.0.1'

  const username = crypto.randomBytes(8).toString('hex')
  const password = crypto.randomBytes(8).toString('hex')

  await setTurnCredentials(username, password, ttl)

  return [
    {
      urls: [`turn:${host}:3478`, `turns:${host}:5349`],
      username,
      credential: password,
    },
  ]
}
