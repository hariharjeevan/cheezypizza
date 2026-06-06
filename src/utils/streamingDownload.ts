/**
 * utils/streamingDownload.ts
 *
 * No-storage streaming path used when browser quota is exceeded.
 * Chunks arriving over WebRTC are piped directly to the user's disk
 * without being written to OPFS or IDB first.
 */

import { Zip, ZipPassThrough } from 'fflate'

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

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  )
}

// Sink abstraction

export interface StreamingSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
  onSinkAborted?: () => void
}

export async function openStreamingSink(
  filename: string,
  size?: number,
): Promise<StreamingSink> {
  const safeName = filename.replace(/^\/+/, '')

  // 1. File System Access API, no size limit
  if (
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
      let abortFired = false
      const sink: StreamingSink = {
        async write(chunk) {
          try {
            await writable.write(chunk)
          } catch (err) {
            if (!abortFired) {
              abortFired = true
              sink.onSinkAborted?.()
            }
            throw err
          }
        },
        async close() {
          await writable.close()
        },
        async abort() {
          try {
            await writable.abort()
          } catch {
            /* ignore */
          }
        },
      }
      return sink
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err // User cancelled — propagate so caller can surface it
      }
      console.warn(
        '[streamingDownload] showSaveFilePicker failed, trying StreamSaver',
        err,
      )
    }
  }

  // 2. StreamSaver — works on desktop Chrome/Firefox, not on mobile
  if (streamSaver && !isMobileBrowser()) {
    const fileStream = streamSaver.createWriteStream(safeName, { size })
    const writer = fileStream.getWriter()
    let abortFired = false
    const sink: StreamingSink = {
      async write(chunk) {
        try {
          await writer.write(chunk)
        } catch (err) {
          if (!abortFired) {
            abortFired = true
            sink.onSinkAborted?.()
          }
          throw err
        }
      },
      async close() {
        await writer.close()
      },
      async abort() {
        try {
          await writer.abort()
        } catch {
          /* ignore */
        }
      },
    }
    return sink
  }

  throw new Error(
    'No streaming download backend available on this browser. ' +
      'Try using a desktop browser with Chrome or Firefox.',
  )
}

// Single-file streaming controller

export interface SingleFileStreamController {
  /** Feed the next chunk. Must be called in order. */
  writeChunk(chunk: Uint8Array, isFinal: boolean): Promise<void>
  /** Abort if transfer fails. */
  abort(reason?: string): Promise<void>
}

export async function openSingleFileStream(
  fileName: string,
  size: number,
  onAborted?: () => void,
): Promise<SingleFileStreamController> {
  const sink = await openStreamingSink(fileName, size)

  if (onAborted) {
    sink.onSinkAborted = onAborted
  }

  return {
    async writeChunk(chunk, isFinal) {
      await sink.write(chunk)
      if (isFinal) {
        await sink.close()
      }
    },
    async abort(reason) {
      console.warn('[streamingDownload] aborting single-file stream:', reason)
      await sink.abort()
    },
  }
}

// Multi-file zip streaming controller

export interface MultiFileStreamController {
  /** Begin a new file entry. Must be called before writeChunk for each file. */
  beginFile(fileName: string): void
  /** Feed the next chunk for the current file. */
  writeChunk(chunk: Uint8Array, isFinal: boolean): void
  /** Called after the last file's final chunk. */
  finalize(): void
  /** Abort if transfer fails. */
  abort(reason?: string): Promise<void>
}

export async function openMultiFileZipStream(
  zipFileName: string,
  onAborted?: () => void,
): Promise<MultiFileStreamController> {
  const sink = await openStreamingSink(zipFileName)

  if (onAborted) {
    sink.onSinkAborted = onAborted
  }

  let currentEntry: ZipPassThrough | null = null
  let zipEnded = false

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      console.error('[streamingDownload] zip error:', err)
      sink.abort().catch(() => {})
      return
    }
    sink.write(chunk).catch((writeErr) => {
      console.error('[streamingDownload] sink write error:', writeErr)
    })
    if (final) {
      sink.close().catch((closeErr) => {
        console.error('[streamingDownload] sink close error:', closeErr)
      })
    }
  })

  return {
    beginFile(fileName: string) {
      const safeName = fileName.replace(/^\/+/, '')
      currentEntry = new ZipPassThrough(safeName)
      zip.add(currentEntry)
    },

    writeChunk(chunk: Uint8Array, isFinal: boolean) {
      if (!currentEntry) {
        console.error('[streamingDownload] writeChunk called before beginFile')
        return
      }
      currentEntry.push(chunk, false)
      if (isFinal) {
        // Signal end of this zip entry
        currentEntry.push(new Uint8Array(0), true)
        currentEntry = null
      }
    },

    finalize() {
      if (!zipEnded) {
        zipEnded = true
        zip.end()
      }
    },

    async abort(reason?: string) {
      console.warn('[streamingDownload] aborting multi-file stream:', reason)
      if (!zipEnded) {
        zipEnded = true
        try {
          zip.end()
        } catch {
          /* ignore */
        }
      }
      await sink.abort()
    },
  }
}
