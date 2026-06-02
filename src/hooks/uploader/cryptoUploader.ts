// hooks/uploader/cryptoUploader.ts
import { createSHA256 } from 'hash-wasm'

const CHUNK_SIZE = 8 * 1024 * 1024

type WorkerProgressMessage = {
  type: 'progress'
  progress: number
}

type WorkerResultMessage = {
  type: 'result'
  sha256: string
}

type WorkerErrorMessage = {
  type: 'error'
  error: string
}

function createHashWorker() {
  return new Worker(new URL('../hashWorker.ts', import.meta.url), {
    type: 'module',
  })
}

export function computeStreamingSHA256(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      computeStreamingSHA256MainThread(file).then(resolve).catch(reject)
      return
    }

    const worker = createHashWorker()
    const cleanup = () => worker.terminate()

    worker.onmessage = (
      event: MessageEvent<
        WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage
      >,
    ) => {
      const message = event.data
      if (message.type === 'progress') {
        onProgress?.(message.progress)
        return
      }

      cleanup()
      if (message.type === 'error') {
        reject(new Error(message.error))
      } else if (message.type === 'result') {
        resolve(message.sha256)
      } else {
        reject(new Error('Worker returned unexpected response'))
      }
    }

    worker.onerror = (err) => {
      cleanup()
      reject(new Error(`Hash worker error: ${err.message}`))
    }

    worker.postMessage({ type: 'file', file })
  })
}

export async function computeStreamingSHA256MainThread(
  file: File,
): Promise<string> {
  const hasher = await createSHA256()
  hasher.init()
  let offset = 0
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE)
    const buf = await slice.arrayBuffer()
    hasher.update(new Uint8Array(buf))
    offset += CHUNK_SIZE
  }
  return hasher.digest('hex')
}
