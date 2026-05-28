import { useState, useCallback, useRef, useEffect } from 'react'
import { useWebRTCPeer } from '../components/WebRTCProvider'
import { z } from 'zod'
import { ChunkMessage, decodeMessage, Message, MessageType } from '../messages'
import { DataConnection } from 'peerjs'
import {
  streamDownloadMultipleFiles,
  streamDownloadSingleFile,
} from '../utils/download'
import {
  browserName,
  browserVersion,
  osName,
  osVersion,
  mobileVendor,
  mobileModel,
} from 'react-device-detect'
import { setRotating } from './useRotatingSpinner'
import {
  getOrCreateOPFSFile,
  openWritableStream,
  writeChunk,
  readOPFSFileAsStream,
  deleteOPFSFile,
  hasOPFSWriteSupport,
  hasEnoughQuota,
} from '../utils/opfsCache'
import { saveProgress, getProgress, clearProgress } from '../utils/resumeStore'

const cleanErrorMessage = (errorMessage: string): string =>
  errorMessage.startsWith('Could not connect to peer')
    ? 'Could not connect to the uploader. Did they close their browser?'
    : errorMessage

const getZipFilename = (): string => `filepizza-download-${Date.now()}.zip`

// SHA-256 helpers

/**
 * Computes SHA-256 of a ReadableStream without loading the whole file into memory.
 * Uses DigestStream (Chrome 111+) when available; falls back to chunk accumulation.
 */
type DigestStreamConstructor = new (
  algorithm: string,
) => { writable: WritableStream<Uint8Array>; digest: Promise<ArrayBuffer> }

async function hashStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const DigestStreamCtor =
    (globalThis as unknown as {
      DigestStream?: DigestStreamConstructor
    }).DigestStream
  if (typeof DigestStreamCtor !== 'undefined') {
    const ds = new DigestStreamCtor('SHA-256')
    await stream.pipeTo(ds.writable)
    const digest: ArrayBuffer = await ds.digest
    return hexFromBuffer(digest)
  }

  // Fallback: accumulate then hash
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalLen = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      totalLen += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }
  const merged = new Uint8Array(totalLen)
  let off = 0
  for (const c of chunks) {
    merged.set(c, off)
    off += c.byteLength
  }
  return hexFromBuffer(await crypto.subtle.digest('SHA-256', merged))
}

function hexFromBuffer(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function normalizeChunkBytes(bytes: unknown): Promise<Uint8Array> {
  if (bytes instanceof Uint8Array) return bytes
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  if (bytes instanceof Blob) {
    return new Uint8Array(await bytes.arrayBuffer())
  }

  throw new Error('Unsupported chunk bytes type')
}

async function computeSessionIdFromFiles(
  files: Array<{ fileName: string; size: number; sha256?: string }>,
): Promise<string> {
  const parts: string[] = files.map(
    (f) => `${f.fileName}:${f.size}:${f.sha256 ?? ''}`,
  )
  const enc = new TextEncoder().encode(parts.join('|'))
  const digest = await crypto.subtle.digest('SHA-256', enc)
  return hexFromBuffer(digest)
}

// Per-file OPFS write state
interface FileWriter {
  writable: FileSystemWritableFileStream
  /** Serialises async writes — each new write appends to this chain. */
  tail: Promise<void>
  closed: boolean
  finalized: boolean
  bytesWritten: number
  expectedSize: number
  nextExpectedOffset: number
  /** Out-of-order chunks waiting for their turn, keyed by offset. */
  pendingChunks: Map<number, { chunk: Uint8Array; isFinal: boolean }>
}

// Helper to flush pending writes and close an OPFS writable stream.
// Called on both pause and stop to ensure data is persisted before the
// FileSystemWritableFileStream is abandoned.
async function closeWriter(writer: FileWriter, label: string): Promise<void> {
  if (writer.closed) return
  try {
    // Wait for any queued writes in the promise chain to complete.
    await writer.tail
  } catch (err) {
    console.warn(
      `[Downloader] writer tail rejected during close (${label}):`,
      err,
    )
  }
  if (writer.closed) return // finalized naturally while awaiting tail
  try {
    writer.closed = true
    await writer.writable.close()
  } catch (err) {
    console.warn(`[Downloader] error closing writer (${label}):`, err)
  }
}

export function useDownloader(uploaderPeerID: string): {
  filesInfo: Array<{ fileName: string; size: number; type: string }> | null
  isConnected: boolean
  isPasswordRequired: boolean
  isDownloading: boolean
  isPaused: boolean
  isDone: boolean
  errorMessage: string | null
  resumeOffsets: Record<string, number>
  submitPassword: (password: string) => void
  startDownload: () => void
  pauseDownload: () => void
  stopDownload: () => void
  totalSize: number
  bytesDownloaded: number
  verifiedHashes: Record<string, string>
} {
  const { peer } = useWebRTCPeer()
  // Ref instead of state: startDownload/pauseDownload/stopDownload are async
  // callbacks that run long after render. Using state means they capture a
  // stale DataConnection from the render in which they were created.
  // A ref always gives the live value regardless of when the callback runs.
  const dataConnectionRef = useRef<DataConnection | null>(null)

  // Wrap conn.send in try/catch because PeerJS can throw even when conn.open
  // is true if the DataChannel transitions state mid-send.
  const safeSend = useCallback((message: z.infer<typeof Message>) => {
    const conn = dataConnectionRef.current
    if (!conn) {
      console.warn(
        '[Downloader] unable to send message, no connection',
        message,
      )
      return
    }
    if (!conn.open) {
      console.warn(
        '[Downloader] unable to send message, connection not open',
        message,
      )
      return
    }
    try {
      conn.send(message)
    } catch (err) {
      console.warn('[Downloader] send threw:', err)
    }
  }, [])

  const [filesInfo, setFilesInfo] = useState<Array<{
    fileName: string
    size: number
    type: string
    sha256?: string
  }> | null>(null)

  // sha256 per fileName, received from uploader in Info message
  const fileHashesRef = useRef<Record<string, string>>({})

  const processChunk = useRef<
    ((message: z.infer<typeof ChunkMessage>) => Promise<void>) | null
  >(null)

  const connectionPromiseRef = useRef<Promise<void> | null>(null)
  const connectionCleanupRef = useRef<(() => void) | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const infoPromiseRef = useRef<Promise<void> | null>(null)
  const infoResolveRef = useRef<(() => void) | null>(null)
  const infoRejectRef = useRef<((reason?: unknown) => void) | null>(null)

  const resetInfoPromise = useCallback(() => {
    infoPromiseRef.current = new Promise<void>((resolve, reject) => {
      infoResolveRef.current = resolve
      infoRejectRef.current = reject
    })
  }, [])

  const waitForInfo = useCallback(async (): Promise<boolean> => {
    if (!infoPromiseRef.current) {
      return true
    }
    try {
      await infoPromiseRef.current
      return true
    } catch {
      return false
    }
  }, [])

  // Track active OPFS writers so pauseDownload / stopDownload can
  // flush and close them before abandoning the FileSystemWritableFileStream.
  // Without this, createWritable on resume may open over an unclosed stream.
  const activeWritersRef = useRef<Record<string, FileWriter>>({})

  const connectToUploader = useCallback(async (): Promise<boolean> => {
    if (!peer) return false
    if (dataConnectionRef.current?.open) return true

    if (connectionPromiseRef.current) {
      try {
        await connectionPromiseRef.current
        return true
      } catch {
        return false
      }
    }

    if (dataConnectionRef.current) {
      dataConnectionRef.current.close()
      dataConnectionRef.current = null
    }

    console.log('[Downloader] connecting to uploader', uploaderPeerID)
    const conn = peer.connect(uploaderPeerID, { reliable: true })
    dataConnectionRef.current = conn
    resetInfoPromise()

    let resolvePromise: () => void = () => {}
    let rejectPromise: (reason?: unknown) => void = () => {}
    const connectionPromise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })
    connectionPromiseRef.current = connectionPromise

    const CONNECTION_TIMEOUT_MS = 30_000

    const timeoutId = setTimeout(() => {
      rejectPromise(new Error('Connection timed out'))
    }, CONNECTION_TIMEOUT_MS)

    const handleOpen = () => {
      clearTimeout(timeoutId)
      console.log('[Downloader] connection opened')
      setIsConnected(true)
      conn.send({
        type: MessageType.RequestInfo,
        browserName,
        browserVersion,
        osName,
        osVersion,
        mobileVendor,
        mobileModel,
      } as z.infer<typeof Message>)
      resolvePromise()
    }

    const handleData = (data: unknown) => {
      try {
        const message = decodeMessage(data)
        console.log('[Downloader] received message', message.type)
        switch (message.type) {
          case MessageType.PasswordRequired:
            setIsPasswordRequired(true)
            if (message.errorMessage) setErrorMessage(message.errorMessage)
            break

          case MessageType.Info: {
            setFilesInfo(message.files)
            setIsPasswordRequired(false)
            const hashes: Record<string, string> = {}
            for (const f of message.files) {
              if (f.sha256) hashes[f.fileName] = f.sha256
            }
            fileHashesRef.current = hashes
            console.log('[Downloader] received file hashes:', hashes)

            if (infoResolveRef.current) {
              infoResolveRef.current()
              infoPromiseRef.current = null
              infoResolveRef.current = null
              infoRejectRef.current = null
            }

            ;(async () => {
              try {
                const sessionId = await computeSessionIdFromFiles(message.files)
                sessionIdRef.current = sessionId
                const results = await Promise.all(
                  message.files.map(async (f: { fileName: string }) => ({
                    fileName: f.fileName,
                    offset: await getProgress(
                      uploaderPeerID,
                      f.fileName,
                      sessionId,
                    ),
                  })),
                )
                const offsets: Record<string, number> = {}
                results.forEach(({ fileName, offset }) => {
                  offsets[fileName] = offset
                })
                setResumeOffsets(offsets)
                console.log(
                  '[Downloader] loaded resume offsets:',
                  offsets,
                  'sessionId=',
                  sessionId,
                )
              } catch (err) {
                console.warn(
                  '[Downloader] failed to load resume offsets with session id',
                  err,
                )
              }
            })()
            break
          }

          case MessageType.Chunk: {
            const result = processChunk.current?.(message)
            if (result instanceof Promise) {
              result.catch((err) =>
                console.error('[Downloader] processChunk error:', err),
              )
            }
            setRotating(true)
            break
          }

          case MessageType.Error:
            console.error('[Downloader] received error message:', message.error)
            setErrorMessage(message.error)
            conn.close()
            break

          case MessageType.Report:
            console.log('[Downloader] received report message, redirecting')
            window.location.href = '/reported'
            break
        }
      } catch (err) {
        console.error('[Downloader] error handling message:', err)
      }
    }

    const handleClose = () => {
      clearTimeout(timeoutId)
      console.log('[Downloader] connection closed')
      setRotating(false)
      dataConnectionRef.current = null
      setIsConnected(false)
      connectionPromiseRef.current = null
      if (infoRejectRef.current) {
        infoRejectRef.current(
          new Error('Connection closed before file info was received'),
        )
        infoPromiseRef.current = null
        infoResolveRef.current = null
        infoRejectRef.current = null
      }
    }

    const handleError = (err: Error) => {
      clearTimeout(timeoutId)
      console.error('[Downloader] connection error:', err)
      setErrorMessage(cleanErrorMessage(err.message))
      if (infoRejectRef.current) {
        infoRejectRef.current(err)
        infoPromiseRef.current = null
        infoResolveRef.current = null
        infoRejectRef.current = null
      }
      if (conn.open) conn.close()
      else handleClose()
      rejectPromise(err)
    }

    conn.on('open', handleOpen)
    conn.on('data', handleData)
    conn.on('error', handleError)
    conn.on('close', handleClose)
    peer.once('error', handleError)

    connectionCleanupRef.current = () => {
      conn.off('open', handleOpen)
      conn.off('data', handleData)
      conn.off('error', handleError)
      conn.off('close', handleClose)
      peer.off('error', handleError)
      if (conn.open) conn.close()
      else conn.once('open', () => conn.close())
    }

    try {
      await connectionPromise
      return true
    } catch {
      return false
    } finally {
      connectionPromiseRef.current = null
    }
  }, [resetInfoPromise, peer, uploaderPeerID])

  const [isConnected, setIsConnected] = useState(false)
  const [isPasswordRequired, setIsPasswordRequired] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isDone, setDone] = useState(false)
  const [bytesDownloaded, setBytesDownloaded] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resumeOffsets, setResumeOffsets] = useState<Record<string, number>>({})
  const [verifiedHashes, setVerifiedHashes] = useState<Record<string, string>>(
    {},
  )

  // Kept for stopDownload cleanup
  const opfsHandlesRef = useRef<Record<string, FileSystemFileHandle>>({})
  const filesInfoRef = useRef<typeof filesInfo>(null)
  useEffect(() => {
    filesInfoRef.current = filesInfo
  }, [filesInfo])

  // Peer connection + message routing
  useEffect(() => {
    if (!peer) return undefined
    connectToUploader().catch((err) => {
      console.error('[Downloader] failed to connect to uploader:', err)
    })

    return () => {
      connectionCleanupRef.current?.()
      connectionCleanupRef.current = null
      connectionPromiseRef.current = null
      dataConnectionRef.current = null
    }
  }, [peer, connectToUploader])

  const submitPassword = useCallback(
    (pass: string) => {
      safeSend({ type: MessageType.UsePassword, password: pass } as z.infer<
        typeof Message
      >)
    },
    [safeSend],
  )

  // OPFS-backed download (single file, OPFS available)
  const startDownload = useCallback(async () => {
    if (!filesInfo) return
    const connected = await connectToUploader()
    if (!connected || !dataConnectionRef.current?.open) {
      setErrorMessage('Unable to connect to the uploader. Please try again.')
      return
    }

    const infoReady = await waitForInfo()
    if (!infoReady || !filesInfo) {
      setErrorMessage(
        'Unable to receive file information from the uploader. Please try again.',
      )
      return
    }

    console.log('[Downloader] starting download')

    const useOPFS = hasOPFSWriteSupport()
    const isMultiFile = filesInfo.length > 1

    if (!useOPFS || isMultiFile) {
      console.log(
        '[Downloader] falling back to direct stream (multi-file or no OPFS support)',
      )
      startDirectDownload()
      return
    }

    const totalBytes = filesInfo.reduce((sum, f) => sum + f.size, 0)
    if (!(await hasEnoughQuota(totalBytes))) {
      console.warn(
        '[Downloader] insufficient OPFS quota — falling back to direct stream',
      )
      startDirectDownload()
      return
    }

    setIsDownloading(true)
    setIsPaused(false)

    // Resolve resume offsets and create OPFS handles
    const opfsHandles: Record<string, FileSystemFileHandle> = {}
    const offsets: Record<string, number> = {}

    try {
      // Ensure we have a session id; if not present (shouldn't happen normally), compute one.
      if (!sessionIdRef.current) {
        try {
          // Build a simple files array including sha256 from fileHashesRef
          const filesForId = filesInfo.map((f) => ({
            fileName: f.fileName,
            size: f.size,
            sha256: fileHashesRef.current[f.fileName],
          }))
          sessionIdRef.current = await computeSessionIdFromFiles(filesForId)
        } catch (err) {
          console.warn(
            '[Downloader] failed to compute session id, continuing without it',
            err,
          )
          sessionIdRef.current = null
        }
      }

      await Promise.all(
        filesInfo.map(async (info) => {
          offsets[info.fileName] = await getProgress(
            uploaderPeerID,
            info.fileName,
            sessionIdRef.current ?? undefined,
          )
          const opfsKey = sessionIdRef.current
            ? `${sessionIdRef.current}::${info.fileName}`
            : info.fileName
          opfsHandles[info.fileName] = await getOrCreateOPFSFile(opfsKey)
        }),
      )
    } catch (err) {
      console.warn(
        '[Downloader] failed to prepare OPFS handles, falling back',
        err,
      )
      setIsDownloading(false)
      startDirectDownload()
      return
    }

    opfsHandlesRef.current = opfsHandles

    const writers: Record<string, FileWriter> = {}
    setBytesDownloaded(Object.values(offsets).reduce((s, o) => s + o, 0))

    try {
      await Promise.all(
        filesInfo.map(async (info) => {
          const startOffset = offsets[info.fileName]
          let resumeOffset = startOffset

          if (startOffset > 0) {
            const existingFile = await opfsHandles[info.fileName].getFile()
            if (existingFile.size < startOffset) {
              // Chrome discarded unflushed writes — roll back to what's on disk.
              console.warn(
                `[Downloader] OPFS smaller than saved offset for ${info.fileName}: ` +
                  `file=${existingFile.size} saved=${startOffset}. Rolling back.`,
              )
              resumeOffset = existingFile.size
              offsets[info.fileName] = resumeOffset
              await saveProgress(
                uploaderPeerID,
                info.fileName,
                resumeOffset,
                info.size,
                sessionIdRef.current ?? undefined,
              )
            } else if (existingFile.size > startOffset) {
              // Stale bytes beyond recorded offset — will truncate after opening.
              resumeOffset = startOffset
            }
          }

          const writable = await openWritableStream(
            opfsHandles[info.fileName],
            resumeOffset,
          )

          if (resumeOffset > 0) {
            const existingFile = await opfsHandles[info.fileName].getFile()
            if (existingFile.size > resumeOffset) {
              await writable.write({
                type: 'truncate',
                size: resumeOffset,
              } as FileSystemWriteChunkType)
            }
          }

          writers[info.fileName] = {
            writable,
            tail: Promise.resolve(),
            closed: false,
            finalized: false,
            bytesWritten: resumeOffset,
            expectedSize: info.size,
            nextExpectedOffset: resumeOffset,
            pendingChunks: new Map(),
          }
        }),
      )
    } catch (err) {
      console.warn(
        '[Downloader] failed to open OPFS writable streams, falling back',
        err,
      )
      setIsDownloading(false)
      startDirectDownload()
      return
    }

    // Store active writers so pauseDownload / stopDownload can close them.
    activeWritersRef.current = writers

    let nextFileIndex = 0
    const startNextFileOrFinish = () => {
      if (nextFileIndex >= filesInfo.length) return
      const info = filesInfo[nextFileIndex]
      console.log(
        `[Downloader] requesting ${info.fileName} from offset ${offsets[info.fileName]}`,
      )
      safeSend({
        type: MessageType.Start,
        fileName: info.fileName,
        offset: offsets[info.fileName],
      } as z.infer<typeof Message>)
      nextFileIndex++
    }

    // Process chunks in order, buffering out-of-order arrivals.
    // When a file is complete, verify the final OPFS file against the expected
    // SHA-256 hash from the uploader.
    processChunk.current = async (message: z.infer<typeof ChunkMessage>) => {
      const writer = writers[message.fileName]
      if (!writer) {
        console.error('[Downloader] no writer for', message.fileName)
        return
      }

      const chunk = await normalizeChunkBytes(message.bytes)
      const fileName = message.fileName
      const chunkOffset = message.offset
      const isFinal = message.final

      // Duplicate chunk — ack and skip
      if (chunkOffset < writer.nextExpectedOffset) {
        console.warn('[Downloader] duplicate chunk ignored', {
          fileName,
          chunkOffset,
        })
        safeSend({
          type: MessageType.ChunkAck,
          fileName,
          offset: chunkOffset,
          bytesReceived: chunk.byteLength,
        } as z.infer<typeof Message>)
        return
      }

      // Out-of-order — buffer for later
      if (chunkOffset !== writer.nextExpectedOffset) {
        console.log('[Downloader] buffering out-of-order chunk', {
          fileName,
          chunkOffset,
          expected: writer.nextExpectedOffset,
        })
        writer.pendingChunks.set(chunkOffset, { chunk, isFinal })
        return
      }

      // Write this chunk and flush any now-consecutive buffered chunks
      writer.tail = writer.tail
        .then(async () => {
          if (writer.closed || writer.finalized) return

          let currentChunk = chunk
          let currentOffset = chunkOffset
          let currentIsFinal = isFinal

          while (true) {
            const chunkSize = currentChunk.byteLength

            await writeChunk(writer.writable, currentChunk, currentOffset)
            writer.bytesWritten += chunkSize
            writer.nextExpectedOffset += chunkSize

            await saveProgress(
              uploaderPeerID,
              fileName,
              writer.nextExpectedOffset,
              writer.expectedSize,
              sessionIdRef.current ?? undefined,
            )
            setBytesDownloaded((bd) => bd + chunkSize)
            setRotating(true)

            safeSend({
              type: MessageType.ChunkAck,
              fileName,
              offset: currentOffset,
              bytesReceived: chunkSize,
            } as z.infer<typeof Message>)

            // Check if we can flush the next buffered chunk
            if (!currentIsFinal) {
              const next = writer.pendingChunks.get(writer.nextExpectedOffset)
              if (!next) break
              writer.pendingChunks.delete(writer.nextExpectedOffset)
              currentOffset = writer.nextExpectedOffset
              currentChunk = next.chunk
              currentIsFinal = next.isFinal
              continue
            }

            // Final chunk written — check if all bytes are accounted for
            if (writer.nextExpectedOffset !== writer.expectedSize) {
              console.error(
                '[Downloader] final chunk written but size mismatch',
                {
                  fileName,
                  written: writer.nextExpectedOffset,
                  expected: writer.expectedSize,
                },
              )
              break
            }

            writer.finalized = true
            writer.closed = true
            await writer.writable.write({
              type: 'truncate',
              size: writer.expectedSize,
            } as FileSystemWriteChunkType)
            await writer.writable.close()

            // Remove this writer from active writers once the file is complete.
            delete activeWritersRef.current[fileName]

            // Verify the finished OPFS file against the expected SHA-256 hash.
            // This covers bytes written in any prior paused session as well as
            // the current download session.
            const expectedHash = fileHashesRef.current[fileName]
            if (expectedHash) {
              console.log(`[Downloader] verifying SHA-256 for ${fileName}`)
              try {
                const opfsStream = await readOPFSFileAsStream(
                  opfsHandles[fileName],
                )
                const actualHash = await hashStream(opfsStream)
                if (actualHash !== expectedHash) {
                  throw new Error(
                    `SHA-256 mismatch for ${fileName}: expected ${expectedHash}, got ${actualHash}`,
                  )
                }
                console.log(
                  `[Downloader] integrity OK for ${fileName}: ${actualHash}`,
                )
                setVerifiedHashes((prev) => ({
                  ...prev,
                  [fileName]: actualHash,
                }))
              } catch (integrityErr) {
                console.error(
                  '[Downloader] integrity check failed:',
                  integrityErr,
                )
                setErrorMessage(
                  `Integrity check failed for ${fileName}. The file may be corrupt — please try again.`,
                )
                delete writers[fileName]
                await clearProgress(
                  uploaderPeerID,
                  fileName,
                  sessionIdRef.current ?? undefined,
                )
                const opfsKey = sessionIdRef.current
                  ? `${sessionIdRef.current}::${fileName}`
                  : fileName
                await deleteOPFSFile(opfsKey)
                return
              }
            } else {
              console.warn(
                `[Downloader] no hash available for ${fileName}, skipping integrity check`,
              )
            }

            delete writers[fileName]

            // Trigger browser save-as from OPFS
            const handle = opfsHandles[fileName]
            const file = await handle.getFile()

            await streamDownloadSingleFile(
              {
                name: fileName.replace(/^\//, ''),
                size: file.size,
                stream: () =>
                  file.stream() as unknown as ReadableStream<Uint8Array>,
              },
              fileName.replace(/^\//, ''),
            )

            await clearProgress(
              uploaderPeerID,
              fileName,
              sessionIdRef.current ?? undefined,
            )
            const opfsKey = sessionIdRef.current
              ? `${sessionIdRef.current}::${fileName}`
              : fileName
            await deleteOPFSFile(opfsKey)
            delete opfsHandlesRef.current[fileName]

            startNextFileOrFinish()

            if (nextFileIndex >= filesInfo.length) {
              safeSend({ type: MessageType.Done } as z.infer<typeof Message>)
              setDone(true)
              setIsDownloading(false)
              setRotating(false)
              activeWritersRef.current = {}
            }
            break
          }
        })
        .catch((err) => {
          console.error('[Downloader] write/finalize error for', fileName, err)
          setErrorMessage(`Download failed for ${fileName}: ${err.message}`)
        })
    }

    startNextFileOrFinish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesInfo, uploaderPeerID])

  // Fallback direct-stream download for multi-file or non-OPFS paths.
  // Out-of-order chunks are buffered and SHA-256 is verified before browser
  // save-as is triggered.
  const startDirectDownload = useCallback(() => {
    if (!filesInfo || !dataConnectionRef.current) return
    setIsDownloading(true)
    setIsPaused(false)

    type DirectFileStream = {
      enqueue: (chunk: Uint8Array) => void
      close: () => void
      isClosed: boolean
      nextExpectedOffset: number
      pendingChunks: Map<number, { chunk: Uint8Array; isFinal: boolean }>
      // Accumulated for hashing — direct path can't stream from disk
      receivedChunks: Uint8Array[]
      totalReceived: number
    }

    const fileStreamByPath: Record<string, DirectFileStream> = {}

    const fileStreams = filesInfo.map((info) => {
      let enqueue: ((chunk: Uint8Array) => void) | null = null
      let close: (() => void) | null = null
      let isClosed = false

      const stream = new ReadableStream<Uint8Array>({
        start(ctrl) {
          enqueue = (c) => {
            if (!isClosed) ctrl.enqueue(c)
          }
          close = () => {
            if (!isClosed) {
              isClosed = true
              ctrl.close()
            }
          }
        },
        cancel() {
          isClosed = true
        },
      })

      if (!enqueue || !close)
        throw new Error('Failed to initialize stream controllers')

      fileStreamByPath[info.fileName] = {
        enqueue,
        close,
        isClosed: false,
        nextExpectedOffset: 0,
        pendingChunks: new Map(),
        receivedChunks: [],
        totalReceived: 0,
      }
      return stream
    })

    let nextFileIndex = 0
    const startNextFileOrFinish = () => {
      if (nextFileIndex >= filesInfo.length) return
      safeSend({
        type: MessageType.Start,
        fileName: filesInfo[nextFileIndex].fileName,
        offset: 0,
      } as z.infer<typeof Message>)
      nextFileIndex++
    }

    // Verify hash for a direct-stream file after all chunks have been received.
    const verifyDirectHash = async (
      fileName: string,
      fs: DirectFileStream,
    ): Promise<boolean> => {
      const expectedHash = fileHashesRef.current[fileName]
      if (!expectedHash) {
        console.warn(
          `[Downloader] no hash for ${fileName}, skipping verification`,
        )
        return true
      }
      console.log(
        `[Downloader] verifying SHA-256 for direct stream ${fileName}`,
      )
      // Build a ReadableStream from accumulated chunks
      const chunks = fs.receivedChunks.slice()
      const verifyStream = new ReadableStream<Uint8Array>({
        start(ctrl) {
          for (const c of chunks) ctrl.enqueue(c)
          ctrl.close()
        },
      })
      const actualHash = await hashStream(verifyStream)
      if (actualHash !== expectedHash) {
        console.error(
          `[Downloader] hash mismatch for ${fileName}: expected ${expectedHash}, got ${actualHash}`,
        )
        return false
      }
      console.log(
        `[Downloader] integrity OK for direct stream ${fileName}: ${actualHash}`,
      )
      setVerifiedHashes((prev) => ({ ...prev, [fileName]: actualHash }))
      return true
    }

    processChunk.current = async (message: z.infer<typeof ChunkMessage>) => {
      const fs = fileStreamByPath[message.fileName]
      if (!fs || fs.isClosed) return

      const chunk = await normalizeChunkBytes(message.bytes)
      const chunkOffset = message.offset
      const isFinal = message.final

      // Duplicate
      if (chunkOffset < fs.nextExpectedOffset) {
        safeSend({
          type: MessageType.ChunkAck,
          fileName: message.fileName,
          offset: chunkOffset,
          bytesReceived: chunk.byteLength,
        } as z.infer<typeof Message>)
        return
      }

      // Out-of-order — buffer
      if (chunkOffset !== fs.nextExpectedOffset) {
        fs.pendingChunks.set(chunkOffset, { chunk, isFinal })
        return
      }

      // Flush in order
      let currentChunk = chunk
      let currentOffset = chunkOffset
      let currentIsFinal = isFinal

      const flush = () => {
        while (true) {
          const chunkSize = currentChunk.byteLength
          try {
            fs.enqueue(currentChunk)
            fs.receivedChunks.push(currentChunk)
            fs.totalReceived += chunkSize
            fs.nextExpectedOffset += chunkSize
            setBytesDownloaded((bd) => bd + chunkSize)

            safeSend({
              type: MessageType.ChunkAck,
              fileName: message.fileName,
              offset: currentOffset,
              bytesReceived: chunkSize,
            } as z.infer<typeof Message>)

            if (currentIsFinal) {
              // Hash verification happens async; we close the stream after it passes
              verifyDirectHash(message.fileName, fs)
                .then((ok) => {
                  if (!ok) {
                    setErrorMessage(
                      `Integrity check failed for ${message.fileName}. The file may be corrupt — please try again.`,
                    )
                    return
                  }
                  fs.close()
                  startNextFileOrFinish()
                })
                .catch((err) => {
                  console.error('[Downloader] hash verification error:', err)
                  setErrorMessage(
                    `Integrity check failed for ${message.fileName}`,
                  )
                })
              return
            }
          } catch (err) {
            console.error('[Downloader] direct stream enqueue failed', err)
            return
          }

          const next = fs.pendingChunks.get(fs.nextExpectedOffset)
          if (!next) break
          fs.pendingChunks.delete(fs.nextExpectedOffset)
          currentOffset = fs.nextExpectedOffset
          currentChunk = next.chunk
          currentIsFinal = next.isFinal
        }
      }

      flush()
    }

    const downloads = filesInfo.map((info, i) => ({
      name: info.fileName.replace(/^\//, ''),
      size: info.size,
      stream: () => fileStreams[i],
    }))

    const downloadPromise =
      downloads.length === 1
        ? streamDownloadSingleFile(downloads[0], downloads[0].name)
        : streamDownloadMultipleFiles(downloads, getZipFilename())

    downloadPromise
      .then(() => {
        safeSend({ type: MessageType.Done } as z.infer<typeof Message>)
        setDone(true)
        setIsDownloading(false)
        setRotating(false)
      })
      .catch((err) => console.error('[Downloader] download error:', err))

    startNextFileOrFinish()
  }, [safeSend, filesInfo])

  // Before closing the DataConnection, flush and close all active OPFS
  // writable streams.
  const pauseDownload = useCallback(async () => {
    // flush + close active writers BEFORE closing the connection so
    // all in-flight writes are committed to OPFS.
    const currentWriters = activeWritersRef.current
    activeWritersRef.current = {}
    await Promise.allSettled(
      Object.entries(currentWriters).map(([fileName, writer]) =>
        closeWriter(writer, fileName),
      ),
    )

    if (dataConnectionRef.current) {
      console.log('[Downloader] pausing download')
      safeSend({ type: MessageType.Pause } as z.infer<typeof Message>)
      dataConnectionRef.current.close()
      // Null synchronously — handleClose fires on the next tick, so if the
      // user clicks Download immediately after Pause, connectToUploader would
      // see conn.open === true on the still-closing connection and return early,
      // causing a "send before open" error on the stale connection.
      dataConnectionRef.current = null
      connectionPromiseRef.current = null
    }

    setIsDownloading(false)
    setIsPaused(true)
    setRotating(false)

    // Refresh persisted resume offsets so the UI shows up-to-date progress
    const currentFiles = filesInfoRef.current
    if (!currentFiles) return

    try {
      const results = await Promise.all(
        currentFiles.map(async (f) => ({
          fileName: f.fileName,
          offset: await getProgress(
            uploaderPeerID,
            f.fileName,
            sessionIdRef.current ?? undefined,
          ),
        })),
      )
      const offsets: Record<string, number> = {}
      let total = 0
      results.forEach(({ fileName, offset }) => {
        offsets[fileName] = offset
        total += offset
      })
      setResumeOffsets(offsets)
      setBytesDownloaded(total)
      console.log('[Downloader] pause: updated resume offsets', offsets)
    } catch (err) {
      console.warn('[Downloader] failed to load resume offsets on pause', err)
    }
  }, [safeSend, uploaderPeerID])

  // Stop — closes connection and deletes all OPFS data / progress.
  // Close active writers before cleanup, same reason as pauseDownload.
  const stopDownload = useCallback(async () => {
    const currentWriters = activeWritersRef.current
    activeWritersRef.current = {}
    await Promise.allSettled(
      Object.entries(currentWriters).map(([fileName, writer]) =>
        closeWriter(writer, fileName),
      ),
    )

    if (dataConnectionRef.current) {
      console.log('[Downloader] stopping download')
      safeSend({ type: MessageType.Pause } as z.infer<typeof Message>)
      dataConnectionRef.current.close()
      // Same as pauseDownload: null synchronously so a subsequent
      // connectToUploader call doesn't reuse the closing connection.
      dataConnectionRef.current = null
      connectionPromiseRef.current = null
    }

    const currentFiles = filesInfoRef.current
    if (currentFiles) {
      await Promise.all(
        currentFiles.map(async (f) => {
          try {
            await clearProgress(
              uploaderPeerID,
              f.fileName,
              sessionIdRef.current ?? undefined,
            )
            const opfsKey = sessionIdRef.current
              ? `${sessionIdRef.current}::${f.fileName}`
              : f.fileName
            await deleteOPFSFile(opfsKey)
          } catch (err) {
            console.warn('[Downloader] cleanup error for', f.fileName, err)
          }
        }),
      )
    }

    opfsHandlesRef.current = {}
    setIsDownloading(false)
    setIsPaused(false)
    setDone(false)
    setBytesDownloaded(0)
    setResumeOffsets({})
    setErrorMessage(null)
    setRotating(false)
    setVerifiedHashes({})
  }, [safeSend, uploaderPeerID])

  return {
    filesInfo,
    isConnected,
    isPasswordRequired,
    isDownloading,
    isPaused,
    isDone,
    errorMessage,
    resumeOffsets,
    submitPassword,
    startDownload,
    pauseDownload,
    stopDownload,
    totalSize: filesInfo?.reduce((acc, info) => acc + info.size, 0) ?? 0,
    bytesDownloaded,
    verifiedHashes,
  }
}
