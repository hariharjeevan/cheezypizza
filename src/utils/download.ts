/**
 * utils/download.ts
 *
 * Single-file fallback chain:
 *   1. showSaveFilePicker  -> pump OPFS stream -> FileSystemWritableFileStream
 *   2. StreamSaver mitm    -> service-worker streaming (desktop Chrome/Firefox)
 *   3. Response stream     -> URL.createObjectURL -> <a download>
 *      (buffers fully into memory — unavoidable last resort, works on mobile)
 *
 * Multi-file:
 *   Zip via Web Worker (fflate ZipPassThrough, store-only) -> same save chain as single-file
 *   Worker receives FileSystemFileHandle[] and streams directly from OPFS.
 *   Failed files are excluded before this function is called (see finalizeDownload).
 *
 * Mobile notes:
 *   iOS Safari and most mobile browsers support neither showSaveFilePicker nor
 *   service workers (required by StreamSaver). On the IDB path (mobile),
 *   entries carry a `blob` instead of a `handle`. The objectURL path is used
 *   directly — it loads the full file into memory but it's already in memory
 *   as a Blob from IDB assembly.
 */

import { createZipStream } from '../zip-stream'

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('web-streams-polyfill/polyfill')
}

const streamSaver: typeof import('streamsaver') | null =
  typeof window !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('streamsaver')
    : null

if (typeof window !== 'undefined' && streamSaver) {
  streamSaver.mitm = `${window.location.protocol}//${window.location.host}/stream.html`
}

// Types

export type DownloadFileEntry = {
  /** Display / zip entry name (leading slash stripped internally) */
  name: string
  /** Byte size of the file */
  size: number
} & (
  | {
      /** OPFS handle — desktop path */
      handle: FileSystemFileHandle
      blob?: never
    }
  | {
      /** Assembled Blob — mobile/IDB path */
      blob: Blob
      handle?: never
    }
)

/**
 * Returns true on mobile browsers where StreamSaver's service worker approach
 * is unreliable (iOS Safari, Android WebView, etc.).
 */
function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  )
}

/**
 * Gets a ReadableStream from a DownloadFileEntry regardless of backing store.
 */
async function entryToStream(
  entry: DownloadFileEntry,
): Promise<ReadableStream<Uint8Array>> {
  if (entry.handle) {
    const file = await entry.handle.getFile()
    return file.stream() as unknown as ReadableStream<Uint8Array>
  }
  return entry.blob.stream() as unknown as ReadableStream<Uint8Array>
}

/**
 * Manual pump: ReadableStream → FileSystemWritableFileStream.
 * Avoids pipeTo() which has cross-boundary transfer issues in some browsers.
 */
async function pumpToWritable(
  readable: ReadableStream<Uint8Array>,
  writable: FileSystemWritableFileStream,
): Promise<void> {
  const reader = readable.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(new Uint8Array(value))
    }
    await writable.close()
  } catch (err) {
    try {
      await writable.abort()
    } catch {
      /* ignore */
    }
    throw err
  } finally {
    reader.releaseLock()
  }
}

/**
 * Fallback 2: StreamSaver mitm.
 * Streams on desktop without buffering into main-thread memory.
 * Not used on mobile (service workers unreliable on iOS).
 */
async function saveViaStreamSaver(
  stream: ReadableStream<Uint8Array>,
  filename: string,
  size?: number,
): Promise<void> {
  if (!streamSaver) {
    throw new Error('No download backend available')
  }
  const fileStream = streamSaver.createWriteStream(filename, { size })
  return stream.pipeTo(fileStream)
}

/**
 * Fallback 3 (last resort): stream a ReadableStream via Response + createObjectURL + <a download>.
 * Buffers into memory. On the IDB/mobile path the data is already a Blob in memory,
 * so we skip the Response wrapping and create the object URL directly.
 */
async function saveViaObjectURL(
  streamOrBlob: ReadableStream<Uint8Array> | Blob,
  filename: string,
): Promise<void> {
  let url: string

  if (streamOrBlob instanceof Blob) {
    url = URL.createObjectURL(streamOrBlob)
  } else {
    const response = new Response(streamOrBlob)
    const blob = await response.blob()
    url = URL.createObjectURL(blob)
  }

  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    await new Promise((r) => setTimeout(r, 1000))
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Zip worker helpers

function createWorkerZipStream(
  files: DownloadFileEntry[],
): ReadableStream<Uint8Array> | null {
  // Worker path requires FileSystemFileHandle — not available on IDB/mobile path
  if (files.some((f) => !f.handle)) return null
  if (typeof Worker === 'undefined') return null

  let worker: Worker
  try {
    worker = new Worker(
      new URL('../hooks/downloader/zipWorker.ts', import.meta.url),
      { type: 'module' },
    )
  } catch {
    return null
  }

  let controller: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl

      worker.onmessage = (evt) => {
        const { type, data, message } = evt.data as {
          type: string
          data?: Uint8Array
          message?: string
        }
        switch (type) {
          case 'chunk':
            controller.enqueue(data!)
            break
          case 'done':
            controller.close()
            worker.terminate()
            break
          case 'error':
            controller.error(new Error(message ?? 'Zip worker error'))
            worker.terminate()
            break
        }
      }

      worker.onerror = (err) => {
        controller.error(new Error(err.message ?? 'Zip worker crashed'))
        worker.terminate()
      }

      worker.postMessage({
        type: 'zip',
        files: files.map((f) => ({
          name: f.name,
          handle: f.handle,
          size: f.size,
        })),
      })
    },
    cancel() {
      worker.terminate()
    },
  })

  return stream
}

function createMainThreadZipStream(
  files: DownloadFileEntry[],
): ReadableStream<Uint8Array> {
  return createZipStream({
    start(ctrl) {
      for (const f of files) {
        ctrl.enqueue({
          name: f.name.replace(/^\/+/, ''),
          size: f.size,
          stream: () => {
            let resolved = false
            let fileStream: ReadableStream<Uint8Array>

            return new ReadableStream<Uint8Array>({
              async start(c) {
                if (!resolved) {
                  if (f.handle) {
                    const file = await f.handle.getFile()
                    fileStream = file.stream() as ReadableStream<Uint8Array>
                  } else {
                    fileStream = f.blob.stream() as ReadableStream<Uint8Array>
                  }
                  resolved = true
                }
                const reader = fileStream.getReader()
                try {
                  while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    c.enqueue(value)
                  }
                  c.close()
                } catch (err) {
                  c.error(err)
                } finally {
                  reader.releaseLock()
                }
              },
            })
          },
        })
      }
      ctrl.close()
    },
    pull() {},
  })
}

// Public API

/**
 * Save a single file. Tries:
 *   1. showSaveFilePicker (OPFS/handle path only — no handle on mobile)
 *   2. StreamSaver mitm (desktop only — skipped on mobile)
 *   3. Response + createObjectURL (works everywhere, buffers into memory)
 */
export async function streamDownloadSingleFile(
  file: DownloadFileEntry,
  filename: string,
): Promise<void> {
  const safeName = filename.replace(/^\/+/, '')

  // 1. File System Access API (handle path only)
  if (
    file.handle &&
    typeof window !== 'undefined' &&
    typeof window.showSaveFilePicker === 'function'
  ) {
    try {
      const pickerHandle = await window.showSaveFilePicker({
        suggestedName: safeName,
      })
      const writable = await pickerHandle.createWritable({
        keepExistingData: false,
      })
      const opfsFile = await file.handle.getFile()
      await pumpToWritable(
        opfsFile.stream() as unknown as ReadableStream<Uint8Array>,
        writable,
      )
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.warn(
        '[download] showSaveFilePicker failed, falling back to StreamSaver',
        err,
      )
    }
  }

  // 2. StreamSaver mitm (skip on mobile)
  if (streamSaver && !isMobileBrowser()) {
    try {
      const stream = await entryToStream(file)
      await saveViaStreamSaver(stream, safeName, file.size)
      return
    } catch (err) {
      console.warn(
        '[download] StreamSaver failed, falling back to objectURL',
        err,
      )
    }
  }

  // 3. objectURL — if we already have a Blob (IDB path), use it directly
  await saveViaObjectURL(file.blob ?? (await entryToStream(file)), safeName)
}

/**
 * Save multiple files as a ZIP.
 */
export async function streamDownloadMultipleFiles(
  files: DownloadFileEntry[],
  filename: string,
): Promise<void> {
  if (files.length === 0) return

  const safeName = filename.replace(/^\/+/, '')

  const getZipStream = (): ReadableStream<Uint8Array> => {
    const workerStream = createWorkerZipStream(files)
    if (workerStream) return workerStream
    console.warn(
      '[download] Worker unavailable or IDB path, zipping on main thread',
    )
    return createMainThreadZipStream(files)
  }

  // 1. File System Access API (handle path only)
  if (
    files.every((f) => f.handle) &&
    typeof window !== 'undefined' &&
    typeof window.showSaveFilePicker === 'function'
  ) {
    try {
      const pickerHandle = await window.showSaveFilePicker({
        suggestedName: safeName,
      })
      const writable = await pickerHandle.createWritable({
        keepExistingData: false,
      })
      await pumpToWritable(getZipStream(), writable)
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.warn(
        '[download] showSaveFilePicker failed for zip, falling back to StreamSaver',
        err,
      )
    }
  }

  // 2. StreamSaver mitm (skip on mobile)
  if (streamSaver && !isMobileBrowser()) {
    try {
      await saveViaStreamSaver(getZipStream(), safeName)
      return
    } catch (err) {
      console.warn(
        '[download] StreamSaver failed for zip, falling back to objectURL',
        err,
      )
    }
  }

  // 3. objectURL — buffers into memory
  await saveViaObjectURL(getZipStream(), safeName)
}
