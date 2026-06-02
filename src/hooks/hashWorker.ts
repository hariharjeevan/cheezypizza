import { createSHA256 } from 'hash-wasm'

const CHUNK_SIZE = 8 * 1024 * 1024
const TARGET_CHUNK_MS = 100
const PROGRESS_THROTTLE_MS = 250

export type HashWorkerRequest =
  | { type: 'file'; file: File; fileName?: string }
  | { type: 'stream-init'; fileName?: string }
  | { type: 'stream-chunk'; chunk: ArrayBuffer; fileName?: string }
  | { type: 'stream-done'; fileName?: string }

export type HashWorkerResponse =
  | { type: 'progress'; progress: number; fileName?: string }
  | { type: 'result'; sha256: string; fileName?: string }
  | { type: 'error'; error: string; fileName?: string }

let hasher: Awaited<ReturnType<typeof createSHA256>> | null = null

const initHasher = async () => {
  if (!hasher) {
    hasher = await createSHA256()
  }
  hasher.init()
}

const toUint8Array = (chunk: ArrayBuffer): Uint8Array => {
  return new Uint8Array(chunk)
}

self.onmessage = async (event: MessageEvent<HashWorkerRequest>) => {
  try {
    const request = event.data

    if (request.type === 'file') {
      await initHasher()
      const { file } = request
      let offset = 0
      let chunkSize = CHUNK_SIZE
      let lastProgressAt = performance.now()
      let isFirstChunk = true

      if (file.size === 0) {
        const activeHasher = hasher!
        const sha256 = activeHasher.digest('hex')
        self.postMessage({ type: 'result', sha256 } as HashWorkerResponse)
        return
      }

      while (offset < file.size) {
        const slice = file.slice(offset, offset + chunkSize)
        const t0 = performance.now()
        const buffer = await slice.arrayBuffer()
        const activeHasher = hasher!
        activeHasher.update(new Uint8Array(buffer))
        offset += chunkSize

        const now = performance.now()
        if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
          self.postMessage({
            type: 'progress',
            progress: Math.min(offset / file.size, 1),
            fileName: request.fileName,
          } as HashWorkerResponse)
          lastProgressAt = now
        }

        if (!isFirstChunk) {
          const elapsed = performance.now() - t0
          if (elapsed > 0) {
            const ratio = TARGET_CHUNK_MS / elapsed
            const clampedRatio = Math.max(0.5, Math.min(ratio, 2.0))
            chunkSize = Math.round(chunkSize * clampedRatio)
            chunkSize = Math.max(
              512 * 1024,
              Math.min(32 * 1024 * 1024, chunkSize),
            )
          }
        }

        isFirstChunk = false
      }

      const sha256 = hasher!.digest('hex')
      self.postMessage({
        type: 'result',
        sha256,
        fileName: request.fileName,
      } as HashWorkerResponse)
      return
    }

    if (request.type === 'stream-init') {
      await initHasher()
      return
    }

    if (request.type === 'stream-chunk') {
      if (!hasher) {
        await initHasher()
      }
      hasher!.update(toUint8Array(request.chunk))
      return
    }

    if (request.type === 'stream-done') {
      if (!hasher) {
        await initHasher()
      }
      const sha256 = hasher!.digest('hex')
      self.postMessage({
        type: 'result',
        sha256,
        fileName: request.fileName,
      } as HashWorkerResponse)
      hasher = null
      return
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', error: message } as HashWorkerResponse)
  }
}
