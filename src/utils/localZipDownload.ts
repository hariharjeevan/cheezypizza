// utils/localZipDownload.ts

import { Zip, ZipPassThrough } from 'fflate'
import {
  ensureSW,
  openOPFSSink,
  isOPFSAvailable,
  type OPFSSink,
} from './opfsLocalDownload'

export interface LocalZipController {
  beginFile(fileName: string): void
  writeChunk(chunk: Uint8Array): void
  endFile(): void
  finalize(): Promise<{ blobUrl?: string }>
  abort(): Promise<void>
}

interface Sink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
  finalize?(zipName: string): Promise<{ blobUrl?: string }>
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  )
}

async function openStreamingSink(zipName: string): Promise<Sink> {
  // 1. File System Access API
  if (
    typeof window !== 'undefined' &&
    typeof (window as typeof window & { showSaveFilePicker?: unknown })
      .showSaveFilePicker === 'function'
  ) {
    try {
      const handle = await (
        window as typeof window & {
          showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>
        }
      ).showSaveFilePicker({ suggestedName: zipName })
      const writable = await handle.createWritable({ keepExistingData: false })
      return {
        async write(chunk) {
          await writable.write(chunk)
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err // User cancelled picker — propagate so caller surfaces it
      }
      console.warn('[localZipDownload] FSA failed, trying StreamSaver', err)
    }
  }

  // 2. StreamSaver (desktop Chrome/Firefox, not mobile)
  if (typeof window !== 'undefined') {
    try {
      // Dynamic require so SSR doesn't break
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const streamSaver = require('streamsaver') as typeof import('streamsaver')
      streamSaver.mitm = `${window.location.protocol}//${window.location.host}/stream.html`
      const fileStream = streamSaver.createWriteStream(zipName)
      const writer = fileStream.getWriter()
      return {
        async write(chunk) {
          await writer.write(chunk)
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
    } catch (err) {
      console.warn('[localZipDownload] StreamSaver failed', err)
    }
  }

  throw new Error('No streaming sink available')
}

function wrapOPFSSink(opfs: OPFSSink, zipName: string): Sink {
  return {
    write: (chunk) => opfs.write(chunk),
    close: () => opfs.close(),
    abort: () => opfs.abort(),
    finalize: () => opfs.finalize(zipName, 'application/zip'),
  }
}

function makeBlobSink(zipName: string): Sink {
  const chunks: ArrayBuffer[] = []
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isMobileBrowser =
    /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua)
  return {
    async write(chunk) {
      chunks.push(chunk.buffer as ArrayBuffer)
    },
    async close() {
      /* finalize triggers download */
    },
    async abort() {
      chunks.length = 0
    },
    async finalize() {
      const blob = new Blob(chunks, { type: 'application/zip' })
      chunks.length = 0
      const url = URL.createObjectURL(blob)

      if (isMobileBrowser) {
        return { blobUrl: url }
      }

      const a = document.createElement('a')
      a.href = url
      a.download = zipName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      return {}
    },
  }
}

export async function openLocalZipDownload(
  zipName: string,
): Promise<LocalZipController> {
  ensureSW().catch(() => {}) // warm up SW early; don't block on it

  let sink: Sink

  if (!isMobile()) {
    // Desktop: stream zip directly to disk
    try {
      sink = await openStreamingSink(zipName)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err // User cancelled — let caller handle
      }
      // Streaming unavailable on this desktop browser — fall through to OPFS
      console.warn(
        '[localZipDownload] Desktop streaming failed, falling back to OPFS',
        err,
      )
      sink = await openMobileSink(zipName)
    }
  } else {
    sink = await openMobileSink(zipName)
  }

  let writeError: Error | null = null
  let writeTail: Promise<void> = Promise.resolve()

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      writeError = err
      sink.abort().catch(() => {})
      return
    }
    // Chain writes to preserve order without blocking the sync callback
    writeTail = writeTail
      .then(() => sink.write(chunk.slice()))
      .catch((e) => {
        writeError = e instanceof Error ? e : new Error(String(e))
        sink.abort().catch(() => {})
      })
    if (final) {
      // zip stream ended — close after pending writes drain
      writeTail = writeTail.then(() => sink.close()).catch(() => {})
    }
  })

  let currentEntry: ZipPassThrough | null = null
  let aborted = false
  let finalized = false

  return {
    beginFile(fileName: string) {
      if (aborted || finalized) return
      if (currentEntry) {
        // Safety: close previous entry if caller forgot endFile
        console.warn(
          '[localZipDownload] beginFile called without endFile — closing previous entry',
        )
        currentEntry.push(new Uint8Array(0), true)
        currentEntry = null
      }
      const safeName = fileName.replace(/^\/+/, '')
      const entry = new ZipPassThrough(safeName)
      zip.add(entry)
      currentEntry = entry
    },

    writeChunk(chunk: Uint8Array) {
      if (aborted || finalized || !currentEntry) return
      currentEntry.push(chunk, false)
    },

    endFile() {
      if (aborted || finalized || !currentEntry) return
      currentEntry.push(new Uint8Array(0), true)
      currentEntry = null
    },

    async finalize() {
      if (aborted || finalized) return {}
      finalized = true

      // Close any open entry (safety guard)
      if (currentEntry) {
        console.warn(
          '[localZipDownload] finalize called with open entry — closing it',
        )
        currentEntry.push(new Uint8Array(0), true)
        currentEntry = null
      }

      zip.end() // signals fflate to emit final zip chunk

      // Wait for all sink writes to drain
      await writeTail

      if (writeError) {
        throw writeError
      }

      if (sink.finalize) {
        return await sink.finalize(zipName)
      }
      return {}
    },

    async abort() {
      if (aborted) return
      aborted = true
      finalized = true
      try {
        zip.end()
      } catch {
        /* ignore — may throw if already ended */
      }
      await writeTail.catch(() => {})
      await sink.abort()
    },
  }
}

async function openMobileSink(zipName: string): Promise<Sink> {
  try {
    if (await isOPFSAvailable()) {
      const opfs = await openOPFSSink()
      return wrapOPFSSink(opfs, zipName)
    }
  } catch (err) {
    console.warn('[localZipDownload] OPFS unavailable', err)
  }

  console.warn(
    '[localZipDownload] falling back to in-memory blob — large files may OOM',
  )
  return makeBlobSink(zipName)
}
