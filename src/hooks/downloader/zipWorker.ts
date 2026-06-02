/**
 * zipWorker.ts
 *
 * Web Worker that receives OPFS file handles, reads them as streams,
 * and produces a streaming ZIP (store-only, no compression) via fflate.
 */

import { Zip, ZipPassThrough } from 'fflate'

interface ZipFileEntry {
  name: string
  handle: FileSystemFileHandle
  size: number
}

interface ZipRequest {
  type: 'zip'
  files: ZipFileEntry[]
}

self.onmessage = async (evt: MessageEvent<ZipRequest>) => {
  const { type, files } = evt.data

  if (type !== 'zip') return

  try {
    await streamZip(files)
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

async function streamZip(files: ZipFileEntry[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const zip = new Zip((err, chunk, final) => {
      if (err) {
        reject(err)
        return
      }
      // Transfer ownership — zero copy
      // Use globalThis cast to avoid depending on WebWorker lib types
      ;(
        globalThis as unknown as {
          postMessage(msg: unknown, transfer: Transferable[]): void
        }
      ).postMessage({ type: 'chunk', data: chunk }, [chunk.buffer])
      if (final) resolve()
    })

    // Kick off sequential file streaming
    processFiles(zip, files, 0, reject)
  })

  self.postMessage({ type: 'done' })
}

function processFiles(
  zip: Zip,
  files: ZipFileEntry[],
  index: number,
  reject: (reason: unknown) => void,
): void {
  if (index >= files.length) {
    zip.end()
    return
  }

  const { name, handle, size } = files[index]

  // Sanitise entry name: strip leading slashes
  const entryName = name.replace(/^\/+/, '')

  const entry = new ZipPassThrough(entryName)

  zip.add(entry)

  streamFileToEntry(handle, size, entry)
    .then(() => {
      processFiles(zip, files, index + 1, reject)
    })
    .catch(reject)
}

async function streamFileToEntry(
  handle: FileSystemFileHandle,
  _size: number,
  entry: ZipPassThrough,
): Promise<void> {
  let file: File
  try {
    file = await handle.getFile()
  } catch (err) {
    throw new Error(
      `Failed to read OPFS file "${handle.name}": ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const stream = file.stream() as ReadableStream<Uint8Array>
  const reader = stream.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // false = not the final chunk for this entry
      entry.push(value, false)
    }
    // Signal end of this entry
    entry.push(new Uint8Array(0), true)
  } finally {
    reader.releaseLock()
  }
}
