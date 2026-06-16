'use client'

import { useCallback, useRef, useState } from 'react'
import {
  openSingleFileStream,
  type SingleFileStreamController,
} from '../utils/streamingDownload'
import {
  ensureSW,
  openOPFSSink,
  isOPFSAvailable,
  type OPFSSink,
} from '../utils/opfsLocalDownload'

export type LocalDownloadState =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'connecting' }
  | {
      status: 'receiving'
      fileName: string
      bytesReceived: number
      totalBytes: number
      speedBps: number
    }
  | { status: 'done'; fileNames: string[] }
  | { status: 'error'; message: string }

type FileManifestEntry = { name: string; size: number; type: string }

// Serial write queue
// dc.onmessage is synchronous; sink.write() is async. Without serialisation,
// a slow write could let a faster subsequent chunk overtake it. We chain each
// write onto the previous promise so order is always preserved without
// blocking the message handler.

function makeWriteQueue() {
  let tail: Promise<void> = Promise.resolve()
  return {
    enqueue(fn: () => Promise<void>) {
      tail = tail.then(fn).catch(() => {
        // Errors bubble through the chain but don't stall it.
        // The caller's fn is responsible for surfacing them via setState.
      })
    },
    get tail() {
      return tail
    },
  }
}

export function useLocalDownloader() {
  const [state, setState] = useState<LocalDownloadState>({ status: 'idle' })
  const dcRef = useRef<RTCDataChannel | null>(null)

  const attachDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc
    setState({ status: 'connecting' })

    // Transfer state
    let manifest: FileManifestEntry[] | null = null
    let currentFile: FileManifestEntry | null = null
    const completedFiles: string[] = []
    let cancelled = false
    let bytesReceived = 0 // counts raw bytes received for UI; path-independent

    // Speed tracking: sliding 1-second window, reset per file
    let speedBps = 0
    let speedWindow: { t: number; b: number }[] = []
    function recordBytes(n: number) {
      const now = Date.now()
      speedWindow.push({ t: now, b: n })
      const cutoff = now - 1000
      while (speedWindow.length > 0 && speedWindow[0].t < cutoff)
        speedWindow.shift()
      speedBps = speedWindow.reduce((s, e) => s + e.b, 0)
    }

    // Download path state
    // Determined once per file on file-header; null = not yet determined.
    //   'streaming' - File System Access API or StreamSaver (streamingDownload.ts)
    //   'opfs'      - OPFS write + SW pipe (opfsDownload.ts); mobile-safe
    //   'blob'      - in-memory accumulator; last resort / small files only
    type DownloadPath = 'streaming' | 'opfs' | 'blob'
    let downloadPath: DownloadPath | null = null

    let singleController: SingleFileStreamController | null = null
    let opfsSink: OPFSSink | null = null
    let pendingChunks: Uint8Array[] | null = null
    const writeQueue = makeWriteQueue()
    let blobChunks: Uint8Array[] = []
    ensureSW().catch(() => {})

    // Helpers

    function abortActiveController(reason: string) {
      if (singleController) {
        singleController.abort(reason).catch(() => {})
        singleController = null
      }
      if (opfsSink) {
        opfsSink.abort().catch(() => {})
        opfsSink = null
      }
    }

    function onError(message: string) {
      if (cancelled) return
      abortActiveController(message)
      setState({ status: 'error', message })
    }

    cancelRef.current = () => {
      cancelled = true
      abortActiveController('Download cancelled')
    }

    // Open sink for a file

    async function openSinkForFile(
      file: FileManifestEntry,
    ): Promise<DownloadPath> {
      // 1: Streaming (File System Access API or StreamSaver)
      try {
        singleController = await openSingleFileStream(
          file.name,
          file.size,
          () => onError('Download sink closed unexpectedly'),
        )
        return 'streaming'
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          onError('Download cancelled')
          return 'blob' // path won't be used; onError stops transfer
        }
        console.warn(
          '[LocalDownloader] Streaming unavailable, trying OPFS',
          err,
        )
      }

      // 2: OPFS
      try {
        const available = await isOPFSAvailable()
        if (available) {
          opfsSink = await openOPFSSink()
          return 'opfs'
        }
      } catch (err) {
        console.warn(
          '[LocalDownloader] OPFS unavailable, using blob fallback',
          err,
        )
      }

      // 3: blob
      console.warn('[LocalDownloader] Using in-memory blob fallback')
      blobChunks = []
      return 'blob'
    }

    // DC lifecycle
    dc.binaryType = 'arraybuffer'

    const handleOpen = () => {
      if (cancelled) return
      console.log('[LocalDownloader] DataChannel opened')
      setState({ status: 'connecting' })
    }

    if (dc.readyState === 'open') {
      handleOpen()
    } else if (dc.readyState === 'connecting') {
      dc.addEventListener('open', handleOpen, { once: true })
    } else {
      console.warn(`[LocalDownloader] DC in unexpected state: ${dc.readyState}`)
      setState({ status: 'error', message: `DC in ${dc.readyState} state` })
      return
    }

    // Message handler
    dc.onmessage = (event) => {
      if (cancelled) return
      const data = event.data

      if (typeof data === 'string') {
        let msg: {
          kind: string
          files?: FileManifestEntry[]
          name?: string
          size?: number
          type?: string
        }
        try {
          msg = JSON.parse(data)
        } catch {
          return
        }

        if (msg.kind === 'manifest') {
          manifest = msg.files ?? []
          setState({ status: 'connecting' })
        } else if (
          msg.kind === 'file-header' &&
          msg.name &&
          msg.size !== undefined
        ) {
          currentFile = { name: msg.name, size: msg.size, type: msg.type ?? '' }

          // Reset per-file state
          speedWindow = []
          speedBps = 0
          bytesReceived = 0
          blobChunks = []
          opfsSink = null
          pendingChunks = null

          setState({
            status: 'receiving',
            fileName: msg.name,
            bytesReceived: 0,
            totalBytes: msg.size,
            speedBps: 0,
          })

          // Reset path and open a fresh sink for every file
          downloadPath = null
          pendingChunks = []

          const fileSnapshot = currentFile
          openSinkForFile(fileSnapshot)
            .then((path) => {
              if (cancelled) return
              downloadPath = path

              // Drain queued chunks in order
              const queued = pendingChunks ?? []
              pendingChunks = null
              for (const chunk of queued) {
                dispatchChunk(chunk)
              }
            })
            .catch((err) => {
              onError(
                err instanceof Error
                  ? err.message
                  : 'Failed to open download sink',
              )
            })

          // file-footer
        } else if (msg.kind === 'file-footer' && currentFile) {
          const finishedFile = currentFile
          currentFile = null

          if (downloadPath === null || pendingChunks !== null) {
            // Sink still opening — flush pending chunks then enqueue finalize.
            // By the time writeQueue reaches finalizeFile, downloadPath is set
            // and all chunks have been dispatched.
            const queued = pendingChunks ?? []
            pendingChunks = null
            for (const chunk of queued) {
              dispatchChunk(chunk)
            }
            writeQueue.enqueue(() => finalizeFile(finishedFile))
          } else {
            writeQueue.enqueue(() => finalizeFile(finishedFile))
          }
        }
      } else if (data instanceof ArrayBuffer) {
        const chunk = new Uint8Array(data)

        bytesReceived += chunk.byteLength
        recordBytes(chunk.byteLength)

        if (currentFile) {
          setState({
            status: 'receiving',
            fileName: currentFile.name,
            bytesReceived,
            totalBytes: currentFile.size,
            speedBps,
          })
        }

        if (pendingChunks !== null) {
          // Sink still opening — buffer the chunk
          pendingChunks.push(chunk)
        } else {
          dispatchChunk(chunk)
        }
      }
    }

    // Dispatch a chunk to whichever active path is open.
    function dispatchChunk(chunk: Uint8Array) {
      if (downloadPath === 'streaming') {
        writeQueue.enqueue(async () => {
          try {
            await singleController?.writeChunk(chunk, false)
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Write failed')
          }
        })
      } else if (downloadPath === 'opfs') {
        writeQueue.enqueue(async () => {
          try {
            await opfsSink?.write(chunk)
          } catch (err) {
            onError(err instanceof Error ? err.message : 'OPFS write failed')
          }
        })
      } else {
        // blob: accumulate in memory
        blobChunks.push(chunk)
      }
    }

    // Finalize one file: close the stream entry or trigger download.
    async function finalizeFile(file: FileManifestEntry): Promise<void> {
      if (cancelled) return

      if (downloadPath === 'streaming') {
        try {
          await singleController?.writeChunk(new Uint8Array(0), true)
          singleController = null
        } catch (err) {
          onError(
            err instanceof Error ? err.message : 'Failed to finalise file',
          )
          return
        }
      } else if (downloadPath === 'opfs') {
        // Close OPFS writable, then stream to browser via SW
        const sink = opfsSink
        opfsSink = null
        if (sink) {
          try {
            await sink.close()
            await sink.finalize(
              file.name,
              file.type || 'application/octet-stream',
            )
          } catch (err) {
            onError(
              err instanceof Error
                ? err.message
                : 'Failed to finalise OPFS file',
            )
            return
          }
        }
      } else {
        // Blob fallback: trigger download
        const blob = new Blob(blobChunks as BlobPart[], {
          type: file.type || 'application/octet-stream',
        })
        blobChunks = []

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }

      completedFiles.push(file.name)

      if (manifest && completedFiles.length >= manifest.length) {
        if (!cancelled) {
          setState({ status: 'done', fileNames: [...completedFiles] })
        }
      }
    }

    // DC error / close
    dc.onerror = () => {
      if (cancelled) return
      onError('Connection lost during transfer')
    }

    dc.onclose = () => {
      if (cancelled) return
      setState((prev) => {
        if (prev.status === 'done') return prev
        if (prev.status === 'receiving') {
          abortActiveController('Connection closed unexpectedly')
          return { status: 'error', message: 'Connection closed unexpectedly' }
        }
        return prev
      })
    }
  }, [])

  // cancel
  const cancelRef = useRef<(() => void) | null>(null)

  const cancel = useCallback(() => {
    cancelRef.current?.()
    const dc = dcRef.current
    if (dc) {
      try {
        dc.close()
      } catch {
        /* ignore */
      }
      dcRef.current = null
    }
    setState({ status: 'error', message: 'Download cancelled' })
  }, [])

  return { state, setState, attachDataChannel, cancel }
}
