import type { ChunkSink } from '../hooks/downloader/types'

/**
 * Converts a file name (potentially with path separators) to a safe OPFS entry name.
 */
export function toSafeName(fileName: string): string {
  return fileName.replace(/\//g, '__').replace(/^_+/, '')
}

/**
 * Gets or creates an OPFS file handle for the given fileName.
 */
export async function getOrCreateOPFSFile(
  fileName: string,
): Promise<FileSystemFileHandle> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.storage === 'undefined' ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    throw new Error('OPFS is not available in this browser')
  }
  const root = await navigator.storage.getDirectory()
  return root.getFileHandle(toSafeName(fileName), { create: true })
}

/**
 * Opens a FileSystemWritableFileStream for the given handle, seeked to `startOffset`,
 * and wraps it in a ChunkSink.
 * The caller is responsible for calling sink.close() when done.
 */
export async function openOPFSChunkSink(
  handle: FileSystemFileHandle,
  startOffset: number,
): Promise<ChunkSink> {
  if (!handle) {
    throw new Error('OPFS handle is undefined')
  }
  const writableFactory = (
    handle as FileSystemFileHandle & {
      createWritable?: (opts?: {
        keepExistingData?: boolean
      }) => Promise<FileSystemWritableFileStream>
    }
  ).createWritable
  if (typeof writableFactory !== 'function') {
    throw new Error('OPFS writable streams are not supported in this browser')
  }
  const writable = await writableFactory.call(handle, {
    keepExistingData: startOffset > 0,
  })
  return {
    write(
      params:
        | { type: 'write'; position: number; data: Uint8Array }
        | { type: 'truncate'; size: number },
    ): Promise<void> {
      if (params.type === 'write') {
        // Call with explicit fields — avoids the FileSystemWriteChunkType alias
        // which TS widens to include `string`, breaking discriminated union checks.
        return writable.write({
          type: 'write',
          position: params.position,
          data: params.data,
        })
      } else {
        return writable.write({ type: 'truncate', size: params.size })
      }
    },
    close(): Promise<void> {
      return writable.close()
    },
  }
}

// Kept for callers that need the raw writable (e.g. pumpToWritable in download.ts).

export async function openWritableStream(
  handle: FileSystemFileHandle,
  startOffset: number,
): Promise<FileSystemWritableFileStream> {
  const writableFactory = (
    handle as FileSystemFileHandle & {
      createWritable?: (opts?: {
        keepExistingData?: boolean
      }) => Promise<FileSystemWritableFileStream>
    }
  ).createWritable
  if (typeof writableFactory !== 'function') {
    throw new Error('OPFS writable streams are not supported in this browser')
  }
  return writableFactory.call(handle, { keepExistingData: startOffset > 0 })
}

// Writes a chunk into an already-open FileSystemWritableFileStream.

export async function writeChunk(
  writable: FileSystemWritableFileStream,
  chunk: Uint8Array,
  offset: number,
): Promise<void> {
  await writable.write({
    type: 'write',
    position: offset,
    data: chunk,
  } as FileSystemWriteChunkType)
}

// Returns a ReadableStream over the full contents of an OPFS file.

export async function readOPFSFileAsStream(
  handle: FileSystemFileHandle,
): Promise<ReadableStream<Uint8Array>> {
  const file = await handle.getFile()
  return file.stream() as unknown as ReadableStream<Uint8Array>
}

/**
 * Deletes an OPFS file by key (already-safe name).
 */
export async function deleteOPFSFile(fileName: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(toSafeName(fileName))
  } catch {
    // Already deleted or never existed — safe to ignore.
  }
}

/**
 * Returns true if the browser supports OPFS writes (createWritable).
 * Safari supports navigator.storage.getDirectory but NOT createWritable,
 * so we must probe the handle itself rather than checking getDirectory alone.
 */
export async function hasOPFSWriteSupport(): Promise<boolean> {
  try {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.storage?.getDirectory !== 'function'
    ) {
      return false
    }
    const root = await navigator.storage.getDirectory()
    // Probe a temp handle — don't create, just check the API shape
    const testHandle = await root.getFileHandle('__opfs_probe__', {
      create: true,
    })
    const hasWritable =
      typeof (
        testHandle as FileSystemFileHandle & {
          createWritable?: unknown
        }
      ).createWritable === 'function'
    // Clean up probe file
    try {
      await root.removeEntry('__opfs_probe__')
    } catch {
      /* ignore */
    }
    return hasWritable
  } catch {
    return false
  }
}

/**
 * Checks whether there is enough estimated quota to store a file of the given size.
 * Includes a 50 MB safety buffer.
 */
export async function hasEnoughQuota(fileSize: number): Promise<boolean> {
  const BUFFER = 50 * 1024 * 1024 // 50 MB
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return quota - usage > fileSize + BUFFER
  } catch {
    return true // can't determine — optimistically allow
  }
}

/* IDB chunk store
 * Used on mobile browsers where OPFS createWritable is unavailable.
 * Chunks are stored individually keyed by offset, then assembled into a Blob
 * on close(). The Blob itself is also stored so it survives a page reload
 * (resume: on reconnect we read existing chunks and sum their sizes).
 */
const IDB_NAME = 'filepizza-chunks'
const IDB_VERSION = 1
const CHUNK_STORE = 'chunks'
const BLOB_STORE = 'blobs'

async function openChunkDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(CHUNK_STORE, { keyPath: 'key' })
      req.result.createObjectStore(BLOB_STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function chunkKey(fileKey: string, offset: number): string {
  return `${fileKey}::${offset}`
}

export async function writeIDBChunk(
  fileKey: string,
  offset: number,
  data: Uint8Array,
): Promise<void> {
  const db = await openChunkDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNK_STORE, 'readwrite')
    tx.objectStore(CHUNK_STORE).put({
      key: chunkKey(fileKey, offset),
      offset,
      data,
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// Returns all chunk offsets stored for a given fileKey, sorted ascending.

export async function getIDBChunkOffsets(fileKey: string): Promise<number[]> {
  const db = await openChunkDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNK_STORE, 'readonly')
    const req = tx.objectStore(CHUNK_STORE).getAll()
    req.onsuccess = () => {
      const rows = req.result as Array<{
        key: string
        offset: number
        data: Uint8Array
      }>
      const offsets = rows
        .filter((r) => r.key.startsWith(`${fileKey}::`))
        .map((r) => r.offset)
        .sort((a, b) => a - b)
      resolve(offsets)
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Assembles all stored chunks for fileKey into a Blob and saves it to the
 * blob store. Deletes the individual chunk records.
 */
export async function assembleIDBBlob(
  fileKey: string,
  mimeType = 'application/octet-stream',
): Promise<Blob> {
  const db = await openChunkDB()

  const chunks = await new Promise<Array<{ offset: number; data: Uint8Array }>>(
    (resolve, reject) => {
      const tx = db.transaction(CHUNK_STORE, 'readonly')
      const req = tx.objectStore(CHUNK_STORE).getAll()
      req.onsuccess = () => {
        const rows = req.result as Array<{
          key: string
          offset: number
          data: Uint8Array
        }>
        resolve(
          rows
            .filter((r) => r.key.startsWith(`${fileKey}::`))
            .sort((a, b) => a.offset - b.offset),
        )
      }
      req.onerror = () => reject(req.error)
    },
  )

  // Idempotency guard: if chunks are already gone, return the existing blob
  // rather than overwriting it with an empty one. This handles the case where
  // assembleIDBBlob is called twice (e.g. getBlob called before sink.close resolves).
  if (chunks.length === 0) {
    const existing = await getIDBBlob(fileKey)
    if (existing) return existing
    // No chunks and no blob — return empty (shouldn't happen in normal flow)
    return new Blob([], { type: mimeType })
  }

  const blob = new Blob(
    chunks.map((c) => c.data.buffer as ArrayBuffer),
    { type: mimeType },
  )

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CHUNK_STORE, BLOB_STORE], 'readwrite')
    tx.objectStore(BLOB_STORE).put({ key: fileKey, blob })
    for (const c of chunks) {
      tx.objectStore(CHUNK_STORE).delete(chunkKey(fileKey, c.offset))
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  return blob
}

// Returns a previously assembled Blob for fileKey, or null if not found.

export async function getIDBBlob(fileKey: string): Promise<Blob | null> {
  const db = await openChunkDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, 'readonly')
    const req = tx.objectStore(BLOB_STORE).get(fileKey)
    req.onsuccess = () =>
      resolve(
        (req.result as { key: string; blob: Blob } | undefined)?.blob ?? null,
      )
    req.onerror = () => reject(req.error)
  })
}

//Deletes all chunk and blob records for a given fileKey.

export async function deleteIDBFile(fileKey: string): Promise<void> {
  try {
    const db = await openChunkDB()
    const offsets = await getIDBChunkOffsets(fileKey)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([CHUNK_STORE, BLOB_STORE], 'readwrite')
      for (const offset of offsets) {
        tx.objectStore(CHUNK_STORE).delete(chunkKey(fileKey, offset))
      }
      tx.objectStore(BLOB_STORE).delete(fileKey)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Already deleted or never existed — safe to ignore.
  }
}

//
export function hasIDBSupport(): boolean {
  return typeof indexedDB !== 'undefined'
}

//Returns a ReadableStream over a Blob's contents.

export function blobToStream(blob: Blob): ReadableStream<Uint8Array> {
  return blob.stream() as unknown as ReadableStream<Uint8Array>
}
