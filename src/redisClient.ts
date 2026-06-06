import Redis from 'ioredis'

export { Redis }

let redisClient: Redis | null = null

export function getRedisClient(): Redis | null {
  if (!redisClient && process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL)
    redisClient.on('error', (error) => {
      console.error('[Redis] Error', error)
    })
  }
  return redisClient
}
