import { UploadedFile } from '../../types'
import { getFileName } from '../../fs'
import { computeStreamingSHA256 } from './cryptoUploader'

// Cache keyed by name+size+lastModified so reconnects don't re-hash
const sha256CacheByKey = new Map<string, string>()

function makeFileCacheKey(file: UploadedFile): string {
  const name = getFileName(file)
  // @ts-ignore - File exposes lastModified, Blob does not
  const lastModified =
    typeof file.lastModified === 'number' ? file.lastModified : 0
  return `${name}::${file.size}::${lastModified}`
}

async function getOrComputeSHA256(
  file: UploadedFile,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const key = makeFileCacheKey(file)
  const cached = sha256CacheByKey.get(key)
  if (cached) return cached
  const hash = await computeStreamingSHA256(file as File, onProgress)
  sha256CacheByKey.set(key, hash)
  return hash
}

/**
 * Returns file metadata immediately - no sha256.
 * Used to send Info to the downloader without waiting for hashing.
 */
export function buildFileInfoImmediate(
  files: UploadedFile[],
): Array<{ fileName: string; size: number; type: string }> {
  return files.map((f) => ({
    fileName: getFileName(f),
    size: f.size,
    type: f.type,
  }))
}

export async function computeHashByName(
  fileName: string,
  files: UploadedFile[],
  onProgress?: (progress: number) => void,
): Promise<string | null> {
  const file = files.find((f) => getFileName(f) === fileName)
  if (!file) {
    console.error('[fileInfo] file not found:', fileName)
    return null
  }
  try {
    console.log('[fileInfo] starting hash for', fileName, file.size)
    try {
      const first = await (file as File).slice(0, 64).arrayBuffer()
      const last =
        file.size > 64
          ? await (file as File).slice(file.size - 64, file.size).arrayBuffer()
          : null
      const hex = (buf: ArrayBuffer) =>
        Array.from(new Uint8Array(buf))
          .slice(0, 16)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      console.log(
        `[fileInfo] sample first/last bytes for ${fileName}: ${hex(first)}${last ? ' / ' + hex(last) : ''}`,
      )
    } catch (e) {
      console.warn('[fileInfo] failed to read sample bytes for', fileName, e)
    }
    const hash = await getOrComputeSHA256(file, onProgress)
    console.log('[fileInfo] hash done:', fileName, hash)
    return hash
  } catch (err) {
    console.error(`[fileInfo] failed to compute sha256 for ${fileName}:`, err)
    return null
  }
}

/**
 * Computes sha256 for each file in parallel.
 * Calls onFileHashed as soon as each file's hash is ready —
 * does not wait for all files to finish before notifying.
 *
 * Returns a promise that resolves when all hashes are done.
 * Never rejects - per-file errors are caught and logged individually.
 */
export function computeHashesParallel(
  files: UploadedFile[],
  onFileHashed: (fileName: string, sha256: string) => void,
): Promise<void> {
  const tasks = files.map(async (f) => {
    const fileName = getFileName(f)
    try {
      const hash = await getOrComputeSHA256(f)
      onFileHashed(fileName, hash)
    } catch (err) {
      console.error(`[fileInfo] failed to compute sha256 for ${fileName}:`, err)
    }
  })
  return Promise.all(tasks).then(() => undefined)
}

/**
 * Legacy: computes all hashes and returns complete file info.
 * Still used internally where full info is needed synchronously after hashing.
 */
export async function buildFileInfo(
  files: UploadedFile[],
): Promise<
  Array<{ fileName: string; size: number; type: string; sha256: string }>
> {
  return Promise.all(
    files.map(async (f) => ({
      fileName: getFileName(f),
      size: f.size,
      type: f.type,
      sha256: await getOrComputeSHA256(f),
    })),
  )
}
