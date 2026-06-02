// hooks/downloader/cryptoDownloader.ts
import { createSHA256 } from 'hash-wasm'

type DigestStreamConstructor = new (algorithm: string) => {
  writable: WritableStream<Uint8Array>
  digest: Promise<ArrayBuffer>
}

const CHUNK_SIZE = 8 * 1024 * 1024
const PROGRESS_THROTTLE_MS = 250

export function hexFromBuffer(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Hashes a ReadableStream<Uint8Array> with SHA-256.
 *
 * Uses native DigestStream when available.
 * Falls back to incremental hash-wasm hashing using the stream's natural
 * chunk sizes (dynamic chunking) to avoid extra memory allocations.
 *
 * @param onProgress Progress callback (0–1)
 * @param totalSize Total expected bytes (optional)
 */
export async function hashStream(
  stream: ReadableStream<Uint8Array>,
  onProgress?: (progress: number) => void,
  totalSize?: number,
): Promise<string> {
  const DigestStreamCtor = (
    globalThis as unknown as {
      DigestStream?: DigestStreamConstructor
    }
  ).DigestStream

  // Native browser hashing path
  if (typeof DigestStreamCtor !== 'undefined') {
    const ds = new DigestStreamCtor('SHA-256')

    if (onProgress && totalSize && totalSize > 0) {
      let bytesProcessed = 0
      let lastProgressAt = performance.now()

      const progressTransform = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          bytesProcessed += chunk.byteLength
          const now = performance.now()
          if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
            onProgress(Math.min(bytesProcessed / totalSize, 0.99))
            lastProgressAt = now
          }
          controller.enqueue(chunk)
        },
      })

      await stream.pipeThrough(progressTransform).pipeTo(ds.writable)
      onProgress(1)
      return hexFromBuffer(await ds.digest)
    }

    await stream.pipeTo(ds.writable)
    return hexFromBuffer(await ds.digest)
  }

  if (typeof Worker !== 'undefined') {
    const worker = new Worker(new URL('../hashWorker.ts', import.meta.url), {
      type: 'module',
    })

    let resolveResult: (hash: string) => void
    let rejectResult: (err: Error) => void

    const resultPromise = new Promise<string>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })

    worker.onmessage = (
      event: MessageEvent<{ type: string; sha256?: string; error?: string }>,
    ) => {
      const message = event.data
      if (message.type === 'result' && message.sha256 != null) {
        resolveResult(message.sha256)
      } else if (message.type === 'error' && message.error != null) {
        rejectResult(new Error(message.error))
      }
    }

    worker.onerror = (err) => {
      rejectResult(new Error(err.message))
    }

    worker.postMessage({ type: 'stream-init' })

    const reader = stream.getReader()
    let bytesProcessed = 0
    let lastProgressAt = performance.now()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value || value.byteLength === 0) continue

        const bufferToSend =
          value.byteOffset === 0 && value.byteLength === value.buffer.byteLength
            ? value.buffer
            : value.buffer.slice(
                value.byteOffset,
                value.byteOffset + value.byteLength,
              )

        worker.postMessage({ type: 'stream-chunk', chunk: bufferToSend }, [
          bufferToSend,
        ])

        bytesProcessed += value.byteLength
        if (onProgress && totalSize && totalSize > 0) {
          const now = performance.now()
          if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
            onProgress(Math.min(bytesProcessed / totalSize, 0.99))
            lastProgressAt = now
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    worker.postMessage({ type: 'stream-done' })
    let sha256: string
    try {
      sha256 = await resultPromise
    } finally {
      worker.terminate()
    }

    if (onProgress && totalSize && totalSize > 0) {
      onProgress(1)
    }

    return sha256
  }

  // hash-wasm fallback on the main thread
  const hasher = await createSHA256()
  hasher.init()

  const reader = stream.getReader()
  let bytesProcessed = 0
  let lastProgressAt = performance.now()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      hasher.update(value)
      bytesProcessed += value.byteLength

      if (onProgress && totalSize && totalSize > 0) {
        const now = performance.now()
        if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
          onProgress(Math.min(bytesProcessed / totalSize, 0.99))
          lastProgressAt = now
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (onProgress && totalSize && totalSize > 0) {
    onProgress(1)
  }

  return hasher.digest('hex')
}

export async function hashFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const totalSize = file.size
  const hasher = await createSHA256()
  hasher.init()

  let offset = 0
  let lastProgressAt = performance.now()

  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize)
    const slice = file.slice(offset, end)
    const buffer = await slice.arrayBuffer()
    hasher.update(new Uint8Array(buffer))
    offset += buffer.byteLength

    if (onProgress && totalSize > 0) {
      const now = performance.now()
      if (now - lastProgressAt >= PROGRESS_THROTTLE_MS) {
        onProgress(Math.min(offset / totalSize, 0.99))
        lastProgressAt = now
      }
    }
  }

  if (onProgress && totalSize > 0) {
    onProgress(1)
  }

  return hasher.digest('hex')
}

export async function normalizeChunkBytes(bytes: unknown): Promise<Uint8Array> {
  if (bytes instanceof Uint8Array) return bytes

  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes)
  }

  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  if (bytes instanceof Blob) {
    return new Uint8Array(await bytes.arrayBuffer())
  }

  throw new Error('Unsupported chunk bytes type')
}
