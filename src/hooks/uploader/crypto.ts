import { sha256 } from '@noble/hashes/sha2.js'

const HASH_CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB slices — never OOM

type DigestStreamConstructor = new (algorithm: string) => {
  writable: WritableStream<Uint8Array>
  digest: Promise<ArrayBuffer>
}

function hexFromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i]! & 0xff).toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Compute SHA-256 of a Blob/File without loading it fully into memory.
 *
 * Strategy:
 *   1. If DigestStream is available (Chrome 111+), stream the file through it.
 *   2. Otherwise, read the file in HASH_CHUNK_SIZE slices and feed them to
 *      @noble/hashes sha256 incrementally — works on any browser, any file size.
 */
export async function computeStreamingSHA256(file: Blob): Promise<string> {
  const DigestStreamCtor = (
    globalThis as unknown as { DigestStream?: DigestStreamConstructor }
  ).DigestStream

  if (typeof DigestStreamCtor !== 'undefined') {
    // Fast path: native streaming digest (Chrome 111+)
    const ds = new DigestStreamCtor('SHA-256')
    await file.stream().pipeTo(ds.writable)
    return hexFromBuffer(await ds.digest)
  }

  // Fallback: incremental @noble/hashes — O(HASH_CHUNK_SIZE) memory
  const hasher = sha256.create()
  let offset = 0
  while (offset < file.size) {
    const slice = file.slice(offset, offset + HASH_CHUNK_SIZE)
    const buf = await slice.arrayBuffer() // only 8 MB at a time
    hasher.update(new Uint8Array(buf))
    offset += HASH_CHUNK_SIZE
  }
  const digest = hasher.digest()
  let hex = ''
  for (let i = 0; i < digest.length; i++) {
    hex += (digest[i]! & 0xff).toString(16).padStart(2, '0')
  }
  return hex
}
