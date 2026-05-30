import { UploadedFile } from '../../types'
import { getFileName } from '../../fs'
import { computeStreamingSHA256 } from './crypto'

// Cache keyed by name+size+lastModified so reconnects don't re-hash
const sha256CacheByKey = new Map<string, string>()

function makeFileCacheKey(file: UploadedFile): string {
  const name = getFileName(file)
  // @ts-ignore — File exposes lastModified, Blob does not
  const lastModified =
    typeof file.lastModified === 'number' ? file.lastModified : 0
  return `${name}::${file.size}::${lastModified}`
}

async function getOrComputeSHA256(file: UploadedFile): Promise<string> {
  const key = makeFileCacheKey(file)
  const cached = sha256CacheByKey.get(key)
  if (cached) return cached
  const hash = await computeStreamingSHA256(file)
  sha256CacheByKey.set(key, hash)
  return hash
}

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
