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
import {
  openLocalZipDownload,
  type LocalZipController,
} from '../utils/localZipDownload'

export type ManifestFile = { name: string; size: number; type: string }

export type LocalDownloadState =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'connecting' }
  | { status: 'awaiting-accept'; files: ManifestFile[] }
  | {
      status: 'receiving'
      fileName: string
      bytesReceived: number
      totalBytes: number
      speedBps: number
    }
  | {
      status: 'done'
      fileNames: string[]
      zipBlobUrl?: string
      zipFileName?: string
    }
  | { status: 'error'; message: string }

type FileManifestEntry = ManifestFile

// Serial write queue — preserves async write order for single-file paths.
function makeWriteQueue() {
  let tail: Promise<void> = Promise.resolve()
  return {
    enqueue(fn: () => Promise<void>) {
      tail = tail.then(fn).catch(() => {})
    },
    get tail() {
      return tail
    },
  }
}

export function useLocalDownloader() {
  const [state, setState] = useState<LocalDownloadState>({ status: 'idle' })
  const dcRef = useRef<RTCDataChannel | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const acceptRef = useRef<(() => void) | null>(null)
  const rejectRef = useRef<(() => void) | null>(null)

  const attachDataChannel = useCallback((dc: RTCDataChannel) => {
    dcRef.current = dc
    setState({ status: 'connecting' })

    // Transfer state
    let manifest: FileManifestEntry[] | null = null
    let currentFile: FileManifestEntry | null = null
    const completedFiles: string[] = []
    let cancelled = false
    let bytesReceived = 0 // cumulative across all files
    let manifestTotal = 0 // sum of all file sizes; set on manifest
    let accepted = false // set true when user accepts transfer

    // Speed tracking — sliding 1-second window
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

    let multiMode = false
    let zipName = ''
    let zipController: LocalZipController | null = null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let zipOpening = false

    function drainZipQueue(ctrl: LocalZipController, zipName: string) {
      for (const item of zipOrderedQueue) {
        if (item.kind === 'chunk') {
          ctrl.writeChunk(item.chunk)
        } else if (item.kind === 'begin') {
          ctrl.beginFile(item.name)
        } else {
          ctrl.endFile()
          // If this endFile completes the last file, finalize
          completedFiles.push(item.name)
          if (manifest && completedFiles.length >= manifest.length) {
            doFinalizeZip(ctrl, zipName)
          }
        }
      }
      zipOrderedQueue = []
    }

    // Unified ordered queue for zip events and chunks
    type ZipQueueItem =
      | { kind: 'chunk'; chunk: Uint8Array }
      | { kind: 'begin'; name: string }
      | { kind: 'end'; name: string }
    let zipOrderedQueue: ZipQueueItem[] = []

    function doFinalizeZip(ctrl: LocalZipController, zipName: string) {
      ctrl
        .finalize()
        .then(({ blobUrl }) => {
          if (!cancelled)
            setState({
              status: 'done',
              fileNames: [...completedFiles],
              zipBlobUrl: blobUrl,
              zipFileName: blobUrl ? zipName : undefined,
            })
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : 'Failed to finalise zip')
        })
    }

    // Single-file state
    type DownloadPath = 'streaming' | 'opfs' | 'blob'
    let downloadPath: DownloadPath | null = null
    let singleController: SingleFileStreamController | null = null
    let opfsSink: OPFSSink | null = null
    let pendingChunks: Uint8Array[] | null = null
    const writeQueue = makeWriteQueue()
    // Cast to ArrayBuffer to fix: Uint8Array<ArrayBufferLike> not assignable to BlobPart
    let blobChunks: ArrayBuffer[] = []

    ensureSW().catch(() => {})

    // Helpers

    function abortAll(reason: string) {
      if (zipController) {
        zipController.abort().catch(() => {})
        zipController = null
      }
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
      abortAll(message)
      setState({ status: 'error', message })
    }

    cancelRef.current = () => {
      cancelled = true
      abortAll('Download cancelled')
    }

    async function openSinkForFile(
      file: FileManifestEntry,
    ): Promise<DownloadPath> {
      // 1. Streaming (FSA or StreamSaver)
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
          return 'blob'
        }
        console.warn(
          '[LocalDownloader] Streaming unavailable, trying OPFS',
          err,
        )
      }

      // 2. OPFS
      try {
        if (await isOPFSAvailable()) {
          opfsSink = await openOPFSSink()
          return 'opfs'
        }
      } catch (err) {
        console.warn(
          '[LocalDownloader] OPFS unavailable, using blob fallback',
          err,
        )
      }

      // 3. Blob (last resort)
      console.warn('[LocalDownloader] Using in-memory blob fallback')
      blobChunks = []
      return 'blob'
    }

    function dispatchSingleChunk(chunk: Uint8Array) {
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
        blobChunks.push(chunk.buffer as ArrayBuffer)
      }
    }

    async function finalizeSingleFile(file: FileManifestEntry): Promise<void> {
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
        const blob = new Blob(blobChunks, {
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
      if (manifest && completedFiles.length >= manifest.length && !cancelled) {
        setState({ status: 'done', fileNames: [...completedFiles] })
      }
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

        // manifest
        if (msg.kind === 'manifest') {
          manifest = msg.files ?? []
          manifestTotal = manifest.reduce((s, f) => s + f.size, 0)

          // Pause and ask user to accept
          setState({ status: 'awaiting-accept', files: [...manifest] })

          acceptRef.current = () => {
            if (cancelled) return
            // Guard: DC may have closed while user was reading the dialog
            if (dc.readyState !== 'open') {
              onError('Connection was lost before you could accept')
              return
            }
            accepted = true
            try {
              dc.send(JSON.stringify({ kind: 'ready' }))
            } catch {
              onError('Failed to signal ready to sender')
              return
            }
            setState({ status: 'connecting' })
            if (manifest!.length >= 2) {
              multiMode = true
              zipOpening = true
              zipName = `cheezypizza_files_${Date.now()}.zip`

              openLocalZipDownload(zipName)
                .then((ctrl) => {
                  if (cancelled) {
                    ctrl.abort().catch(() => {})
                    return
                  }
                  zipController = ctrl
                  zipOpening = false
                  drainZipQueue(ctrl, zipName)
                })
                .catch((err) => {
                  zipOpening = false
                  zipOrderedQueue = []
                  if (
                    err instanceof DOMException &&
                    err.name === 'AbortError'
                  ) {
                    onError('Download cancelled')
                  } else {
                    onError(
                      err instanceof Error ? err.message : 'Failed to open zip',
                    )
                  }
                })
            }
          }

          rejectRef.current = () => {
            cancelled = true
            try {
              dc.send(JSON.stringify({ kind: 'cancel' }))
            } catch {
              /* ignore */
            }
            abortAll('Rejected by receiver')
            setState({ status: 'idle' })
          }

          // file-header
        } else if (
          msg.kind === 'file-header' &&
          msg.name &&
          msg.size !== undefined
        ) {
          console.log('[DL] file-header, accepted=', accepted)
          if (!accepted) return // ignore until user accepts
          currentFile = { name: msg.name, size: msg.size, type: msg.type ?? '' }
          speedWindow = []
          speedBps = 0

          setState({
            status: 'receiving',
            fileName: msg.name,
            bytesReceived,
            totalBytes: manifestTotal || msg.size,
            speedBps: 0,
          })

          if (multiMode) {
            const ev: ZipQueueItem = { kind: 'begin', name: msg.name }
            if (zipController) {
              zipController.beginFile(msg.name)
            } else {
              zipOrderedQueue.push(ev)
            }
          } else {
            // Single-file: open fresh sink
            blobChunks = []
            opfsSink = null
            pendingChunks = []
            downloadPath = null

            const fileSnapshot = currentFile
            openSinkForFile(fileSnapshot)
              .then((path) => {
                if (cancelled) return
                downloadPath = path
                const queued = pendingChunks ?? []
                pendingChunks = null
                for (const chunk of queued) dispatchSingleChunk(chunk)
              })
              .catch((err) => {
                onError(
                  err instanceof Error
                    ? err.message
                    : 'Failed to open download sink',
                )
              })
          }

          // file-footer
        } else if (msg.kind === 'file-footer' && currentFile) {
          const finishedFile = currentFile
          currentFile = null

          if (multiMode) {
            if (zipController) {
              zipController.endFile()
              completedFiles.push(finishedFile.name)
              if (manifest && completedFiles.length >= manifest.length) {
                doFinalizeZip(zipController, zipName)
              }
            } else {
              // Queue end event; drainZipQueue handles completedFiles + finalize
              zipOrderedQueue.push({ kind: 'end', name: finishedFile.name })
            }
          } else {
            if (downloadPath === null || pendingChunks !== null) {
              const queued = pendingChunks ?? []
              pendingChunks = null
              for (const chunk of queued) dispatchSingleChunk(chunk)
            }
            writeQueue.enqueue(() => finalizeSingleFile(finishedFile))
          }
        }
      } else if (data instanceof ArrayBuffer) {
        if (!accepted) return // ignore until user accepts
        const chunk = new Uint8Array(data)
        bytesReceived += chunk.byteLength
        recordBytes(chunk.byteLength)

        if (currentFile) {
          setState({
            status: 'receiving',
            fileName: currentFile.name,
            bytesReceived,
            totalBytes: manifestTotal || currentFile.size,
            speedBps,
          })
        }

        if (multiMode) {
          if (zipController) {
            zipController.writeChunk(chunk)
          } else {
            zipOrderedQueue.push({ kind: 'chunk', chunk })
          }
        } else {
          if (pendingChunks !== null) {
            pendingChunks.push(chunk)
          } else {
            dispatchSingleChunk(chunk)
          }
        }
      }
    }

    dc.onerror = () => {
      if (cancelled) return
      onError('Connection lost during transfer')
    }

    dc.onclose = () => {
      if (cancelled) return
      setState((prev) => {
        if (prev.status === 'done') return prev
        if (prev.status === 'awaiting-accept') {
          return {
            status: 'error',
            message: 'Sender disconnected before transfer started',
          }
        }
        if (prev.status === 'receiving') {
          abortAll('Connection closed unexpectedly')
          return { status: 'error', message: 'Connection closed unexpectedly' }
        }
        return prev
      })
    }
  }, [])

  const acceptTransfer = useCallback(() => {
    acceptRef.current?.()
  }, [])

  const rejectTransfer = useCallback(() => {
    rejectRef.current?.()
    const dc = dcRef.current
    if (dc) {
      try {
        dc.close()
      } catch {
        /* ignore */
      }
      dcRef.current = null
    }
  }, [])

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

  return {
    state,
    setState,
    attachDataChannel,
    cancel,
    acceptTransfer,
    rejectTransfer,
  }
}
