// utils/opfsCache.ts

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
 * Opens a FileSystemWritableFileStream for the given handle, seeked to `startOffset`.
 * The caller is responsible for calling writable.close() when done.
 *
 * Keeping one writable open for the entire transfer (rather than opening one
 * per chunk) avoids concurrent-write races and the NotFoundError that results
 * from thrashing open/close under load.
 */
export async function openWritableStream(
  handle: FileSystemFileHandle,
  startOffset: number,
): Promise<FileSystemWritableFileStream> {
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

  return await writableFactory.call(handle, {
    keepExistingData: startOffset > 0,
  })
}

/**
 * Writes a chunk into an already-open FileSystemWritableFileStream.
 * The stream's internal position advances automatically after each write,
 * so no seek() is needed between sequential chunks.
 */
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

/**
 * Returns a ReadableStream over the full contents of an OPFS file.
 */
export async function readOPFSFileAsStream(
  handle: FileSystemFileHandle,
): Promise<ReadableStream<Uint8Array>> {
  const file = await handle.getFile()
  return file.stream() as unknown as ReadableStream<Uint8Array>
}

/**
 * Deletes an OPFS file by fileName.
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
 * Returns true if the browser supports OPFS writes (Chrome/Edge).
 * Safari supports OPFS reads but not createWritable.
 */
export function hasOPFSWriteSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  )
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
