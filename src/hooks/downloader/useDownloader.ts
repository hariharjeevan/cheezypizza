import { useState, useCallback, useRef, useEffect } from 'react'
import { z } from 'zod'
import { ChunkMessage, Message, MessageType } from '../../messages'
import { FileInfo, FileWriter } from './types'
import { closeWriter, openWriter } from './opfsWriter'
import { makeProcessChunk, makeProcessChunkStreaming } from './processChunk'
import { hashFile } from './cryptoDownloader'
import { useTransferStats } from './useTransferStats'
import {
  useUploaderConnection,
  UploaderConnectionCallbacks,
} from './uploaderConnection'
import {
  hasOPFSWriteSupport,
  hasEnoughQuota,
  deleteOPFSFile,
  hasIDBSupport,
} from '../../utils/opfsCache'
import { openIDBWriter } from './idbWriter'
import { getProgress, clearProgress } from '../../utils/resumeStore'
import {
  streamDownloadSingleFile,
  streamDownloadMultipleFiles,
  type DownloadFileEntry,
} from '../../utils/download'
import {
  openSingleFileStream,
  openMultiFileZipStream,
  type SingleFileStreamController,
  type MultiFileStreamController,
} from '../../utils/streamingDownload'
import { setRotating } from '../useRotatingSpinner'

const getZipFilename = (): string => `CheezyPizza-download-${Date.now()}.zip`

// Auto-reconnect config
const MAX_AUTO_RECONNECT_ATTEMPTS = 2
const RECONNECT_BASE_DELAY_MS = 1000
// How long speed must be 0 (after first chunk) before we treat it as a stall
const STALL_TIMEOUT_MS = 15_000

type PendingDownload =
  | {
      kind: 'single'
      name: string
      handle?: FileSystemFileHandle
      blob?: Blob
      info: FileInfo
    }
  | {
      kind: 'multi'
      files: Array<{
        name: string
        handle?: FileSystemFileHandle
        blob?: Blob
        size: number
      }>
    }

async function computeSessionIdFromFiles(
  files: Array<{ fileName: string; size: number; sha256?: string }>,
): Promise<string> {
  const parts = files.map((f) => `${f.fileName}:${f.size}:${f.sha256 ?? ''}`)
  const enc = new TextEncoder().encode(parts.join('|'))
  const digest = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function useDownloader(uploaderPeerID: string): {
  filesInfo: FileInfo[] | null
  isConnected: boolean
  isPasswordRequired: boolean
  isDownloading: boolean
  isPaused: boolean
  isDone: boolean
  errorMessage: string | null
  fileErrors: Record<string, string>
  resumeOffsets: Record<string, number>
  submitPassword: (password: string) => void
  startDownload: () => void
  pauseDownload: () => void
  stopDownload: () => void
  saveFiles: () => Promise<void>
  totalSize: number
  bytesDownloaded: number
  verifiedHashes: Record<string, string>
  computedHashes: Record<string, string>
  isVerifying: boolean
  speedBytesPerSec?: number
  etaSeconds?: number
  isWaitingForUploaderHash: boolean
  hashingProgress: Record<string, number>
  hasPendingDownload: boolean
  readPasteBlob: () => Promise<string | null>
  // New
  quotaExceeded: boolean
  startStreamingDownload: () => Promise<void>
  isReconnecting: boolean
  isStreamingDownload: boolean
} {
  const [filesInfo, setFilesInfo] = useState<FileInfo[] | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isPasswordRequired, setIsPasswordRequired] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isDone, setDone] = useState(false)
  const [bytesDownloaded, setBytesDownloaded] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({})
  const [resumeOffsets, setResumeOffsets] = useState<Record<string, number>>({})
  const [verifiedHashes, setVerifiedHashes] = useState<Record<string, string>>(
    {},
  )
  const [computedHashes, setComputedHashes] = useState<Record<string, string>>(
    {},
  )
  const [isVerifying, setIsVerifying] = useState(false)
  const [hashingProgress, setHashingProgress] = useState<
    Record<string, number>
  >({})
  const [isWaitingForUploaderHash, setIsWaitingForUploaderHash] =
    useState(false)
  const [pendingDownload, setPendingDownload] =
    useState<PendingDownload | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const filesInfoRef = useRef<FileInfo[] | null>(null)
  const fileHashesRef = useRef<Record<string, string>>({})
  const sessionIdRef = useRef<string | null>(null)
  const activeWritersRef = useRef<Record<string, FileWriter>>({})
  const opfsHandlesRef = useRef<Record<string, FileSystemFileHandle>>({})
  const completedCountRef = useRef(0)
  const completedFilesRef = useRef<string[]>([])
  const localHashesRef = useRef<Record<string, string>>({})
  const localHashPromisesRef = useRef<
    Record<string, Promise<string> | undefined>
  >({})
  const infoResolveRef = useRef<(() => void) | null>(null)
  const infoRejectRef = useRef<((reason?: unknown) => void) | null>(null)
  const infoPromiseRef = useRef<Promise<void> | null>(null)
  const connectionCallbacksRef = useRef<UploaderConnectionCallbacks | null>(
    null,
  )
  const idbGettersRef = useRef<Record<string, () => Promise<Blob>>>({})

  // Auto-reconnect state
  const autoReconnectAttemptsRef = useRef(0)
  const isIntentionalDisconnectRef = useRef(false)
  const isDownloadingRef = useRef(false)
  const isReconnectingRef = useRef(false)
  const firstChunkReceivedRef = useRef(false)

  // Streaming path state (quota-exceeded)
  const [isStreamingDownload, setIsStreamingDownload] = useState(false)
  const isStreamingModeRef = useRef(false)
  const singleStreamControllerRef = useRef<SingleFileStreamController | null>(
    null,
  )
  const multiStreamControllerRef = useRef<MultiFileStreamController | null>(
    null,
  )
  const streamingBytesWrittenRef = useRef<Record<string, number>>({})

  // Keep isDownloading in a ref for use inside callbacks without stale closure
  useEffect(() => {
    isDownloadingRef.current = isDownloading
  }, [isDownloading])

  const resetInfoPromise = useCallback(() => {
    infoPromiseRef.current = new Promise<void>((resolve, reject) => {
      infoResolveRef.current = resolve
      infoRejectRef.current = reject
    })
  }, [])

  const computeLocalHash = useCallback(
    async (fileName: string): Promise<string> => {
      const handle = opfsHandlesRef.current[fileName]
      const fileInfo = filesInfoRef.current?.find(
        (f) => f.fileName === fileName,
      )
      if (!fileInfo) {
        throw new Error(`Unable to compute local hash for ${fileName}`)
      }

      const hashKey = sessionIdRef.current
        ? `${sessionIdRef.current}::${fileName}`
        : fileName

      if (localHashPromisesRef.current[hashKey]) {
        return localHashPromisesRef.current[hashKey]
      }

      const hashPromise = (async () => {
        setHashingProgress((prev) => ({ ...prev, [fileName]: 0 }))
        try {
          let file: File | Blob

          if (handle) {
            file = await handle.getFile()
          } else {
            // IDB path — assemble blob via getter
            const getter = idbGettersRef.current[fileName]
            if (!getter) throw new Error(`No blob getter for ${fileName}`)
            file = await getter()
          }

          const localHash = await hashFile(file as File, (progress) => {
            setHashingProgress((prev) => ({ ...prev, [fileName]: progress }))
          })

          setComputedHashes((prev) => ({ ...prev, [fileName]: localHash }))
          localHashesRef.current[fileName] = localHash
          return localHash
        } finally {
          setHashingProgress((prev) => {
            const next = { ...prev }
            delete next[fileName]
            return next
          })
        }
      })()

      localHashPromisesRef.current[hashKey] = hashPromise
      hashPromise.catch(() => {
        delete localHashPromisesRef.current[hashKey]
      })
      return hashPromise
    },
    [],
  )

  const waitForInfo = useCallback(async (): Promise<boolean> => {
    if (!infoPromiseRef.current) return true
    try {
      await infoPromiseRef.current
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    filesInfoRef.current = filesInfo
  }, [filesInfo])

  const { connect, disconnect, safeSend, dataConnectionRef } =
    useUploaderConnection(uploaderPeerID)

  const { speedBytesPerSec, etaSeconds } = useTransferStats(
    isDownloading,
    bytesDownloaded,
    filesInfo,
  )

  const processChunkRef = useRef<
    ((message: z.infer<typeof ChunkMessage>) => Promise<void>) | null
  >(null)

  // session cleanup helpers

  const flushAndCloseAllWriters = useCallback(async () => {
    const current = activeWritersRef.current
    activeWritersRef.current = {}
    await Promise.allSettled(
      Object.entries(current).map(([name, writer]) =>
        closeWriter(writer, name),
      ),
    )
  }, [])

  const clearAllOPFSData = useCallback(async () => {
    const currentFiles = filesInfoRef.current
    if (!currentFiles) return
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
    opfsHandlesRef.current = {}
  }, [uploaderPeerID])

  // file completion logic

  const finalizeDownload = useCallback(
    async (
      passedFiles: string[],
      writers: Record<string, FileWriter>,
      handles: Record<string, FileSystemFileHandle>,
      currentFilesInfo: FileInfo[],
    ) => {
      if (passedFiles.length === 0) {
        setIsDownloading(false)
        setRotating(false)
        return
      }

      // Wait for uploader hashes for any files that still might have them arriving.
      const filesToWaitFor = currentFilesInfo.filter(
        (f) =>
          passedFiles.includes(f.fileName) &&
          !fileHashesRef.current[f.fileName],
      )
      if (filesToWaitFor.length > 0) {
        setIsVerifying(true)
        setIsWaitingForUploaderHash(true)
        await Promise.all(
          filesToWaitFor.map(
            (f) =>
              new Promise<void>((resolve) => {
                const HASH_RATE_BYTES_PER_MS = (20 * 1024 * 1024) / 1000
                const timeoutMs = Math.max(
                  20_000,
                  f.size / HASH_RATE_BYTES_PER_MS,
                )
                const deadline = setTimeout(resolve, timeoutMs)
                const interval = setInterval(() => {
                  if (fileHashesRef.current[f.fileName]) {
                    clearTimeout(deadline)
                    clearInterval(interval)
                    resolve()
                  }
                }, 200)
              }),
          ),
        )
        setIsWaitingForUploaderHash(false)
      }

      setIsVerifying(true)

      const integrityErrors: Array<{ fileName: string; reason: string }> = []
      // Hash ALL files regardless of size for integrity verification
      const filesToHash = currentFilesInfo.filter((f) =>
        passedFiles.includes(f.fileName),
      )

      for (const fileInfo of filesToHash) {
        const fileName = fileInfo.fileName
        const expectedHash = fileHashesRef.current[fileName]

        try {
          const hashKey = sessionIdRef.current
            ? `${sessionIdRef.current}::${fileName}`
            : fileName
          const localHash = await (localHashesRef.current[fileName]
            ? Promise.resolve(localHashesRef.current[fileName])
            : (localHashPromisesRef.current[hashKey] ??
              computeLocalHash(fileName)))

          setComputedHashes((prev) => ({ ...prev, [fileName]: localHash }))
          localHashesRef.current[fileName] = localHash

          if (expectedHash) {
            if (localHash !== expectedHash) {
              console.error(
                `[Downloader] deferred integrity FAIL for ${fileName}:`,
                {
                  expectedHash,
                  localHash,
                },
              )
              integrityErrors.push({
                fileName,
                reason: `Integrity check failed for ${fileName}. The file may be corrupt.`,
              })
              continue
            }

            console.log(
              `[Downloader] deferred integrity OK for ${fileName}: ${localHash}`,
            )
            setVerifiedHashes((prev) => ({ ...prev, [fileName]: localHash }))
          } else {
            // Uploader hash not received after waiting — file transferred
            // successfully but integrity cannot be confirmed. Do NOT delete
            // the file; let the user save it with a warning.
            console.warn(
              `[Downloader] uploader hash not received for ${fileName} - saving without verification`,
            )
            setFileErrors((prev) => ({
              ...prev,
              [fileName]: `${fileName} could not be verified (uploader hash not received). The file may still be intact.`,
            }))
            // Mark in verifiedHashes so saveFiles guard passes and
            // the file is included in pendingDownload.
            setVerifiedHashes((prev) => ({ ...prev, [fileName]: localHash }))
          }
        } catch (integrityErr) {
          console.error('[Downloader] integrity check failed:', integrityErr)
          await clearProgress(
            uploaderPeerID,
            fileInfo.fileName,
            sessionIdRef.current ?? undefined,
          )
          const opfsKey = sessionIdRef.current
            ? `${sessionIdRef.current}::${fileInfo.fileName}`
            : fileInfo.fileName
          await deleteOPFSFile(opfsKey)
          integrityErrors.push({
            fileName: fileInfo.fileName,
            reason: `Integrity check failed for ${fileInfo.fileName}. The file may be corrupt.`,
          })
        }
      }

      setHashingProgress({})
      setIsVerifying(false)

      // Clean up integrity-failed files
      const failedFileNames = new Set(integrityErrors.map((e) => e.fileName))
      if (failedFileNames.size > 0) {
        await Promise.allSettled(
          [...failedFileNames].map(async (fileName) => {
            try {
              await clearProgress(
                uploaderPeerID,
                fileName,
                sessionIdRef.current ?? undefined,
              )
              const opfsKey = sessionIdRef.current
                ? `${sessionIdRef.current}::${fileName}`
                : fileName
              await deleteOPFSFile(opfsKey)
            } catch (err) {
              console.warn(
                '[Downloader] cleanup error for failed file',
                fileName,
                err,
              )
            }
          }),
        )
        setFileErrors((prev) => {
          const next = { ...prev }
          integrityErrors.forEach(({ fileName, reason }) => {
            next[fileName] = reason
          })
          return next
        })
      }

      const verifiableFiles = passedFiles.filter((f) => !failedFileNames.has(f))

      // Store handles for user-gesture-triggered save — do NOT stream here
      if (verifiableFiles.length === 1) {
        const fileName = verifiableFiles[0]
        const info = currentFilesInfo.find((f) => f.fileName === fileName)!
        setPendingDownload({
          kind: 'single',
          name: fileName,
          handle: handles[fileName], // undefined on IDB path
          info,
        })
      } else if (verifiableFiles.length > 1) {
        setPendingDownload({
          kind: 'multi',
          files: verifiableFiles.map((fileName) => ({
            name: fileName,
            handle: handles[fileName],
            size: currentFilesInfo.find((f) => f.fileName === fileName)!.size,
          })),
        })
      }

      safeSend({ type: MessageType.Done } as z.infer<typeof Message>)
      setDone(true)
      setIsDownloading(false)
      setRotating(false)
      activeWritersRef.current = {}
    },
    [uploaderPeerID, safeSend],
  )

  const saveFiles = useCallback(async () => {
    if (!pendingDownload) return

    try {
      if (pendingDownload.kind === 'single') {
        const { name, handle, info } = pendingDownload
        const safeName = info.fileName.replace(/^\/+/, '')

        // Verify file was actually verified before saving
        if (!verifiedHashes[name]) {
          console.error(
            `[Downloader] Attempted to save unverified file: ${name}`,
            { inVerifiedHashes: name in verifiedHashes, verifiedHashes },
          )
          setErrorMessage(
            `File ${safeName} was not verified. This should not happen.`,
          )
          return
        }

        const entry: DownloadFileEntry = handle
          ? { name: safeName, size: info.size, handle }
          : {
              name: safeName,
              size: info.size,
              blob: await idbGettersRef.current[name](),
            }

        await streamDownloadSingleFile(entry, safeName)

        // Clean up OPFS after successful save
        try {
          await clearProgress(
            uploaderPeerID,
            name,
            sessionIdRef.current ?? undefined,
          )
          const opfsKey = sessionIdRef.current
            ? `${sessionIdRef.current}::${name}`
            : name
          await deleteOPFSFile(opfsKey)
          delete opfsHandlesRef.current[name]
        } catch (err) {
          console.warn('[Downloader] cleanup error after save for', name, err)
        }
      } else {
        // Multi-file: verify all files were actually verified
        const unverifiedFiles = pendingDownload.files.filter(
          ({ name }) => !verifiedHashes[name],
        )
        if (unverifiedFiles.length > 0) {
          console.error(
            `[Downloader] Attempted to save unverified files:`,
            unverifiedFiles.map((f) => f.name),
            { verifiedHashes },
          )
          const fileList = unverifiedFiles.map((f) => f.name).join(', ')
          setErrorMessage(
            `Files were not verified: ${fileList}. This should not happen.`,
          )
          return
        }

        // Multi-file: pass only the pending (already verified) entries.
        // Failed files are never added to pendingDownload.files (filtered in finalizeDownload).
        const entries: DownloadFileEntry[] = await Promise.all(
          pendingDownload.files.map(async ({ name, handle, size }) => {
            const safeName = name.replace(/^\/+/, '')
            if (handle) return { name: safeName, size, handle }
            const blob = await idbGettersRef.current[name]()
            return { name: safeName, size, blob }
          }),
        )

        await streamDownloadMultipleFiles(entries, getZipFilename())

        // Clean up OPFS after successful save
        await Promise.all(
          pendingDownload.files.map(async ({ name }) => {
            try {
              await clearProgress(
                uploaderPeerID,
                name,
                sessionIdRef.current ?? undefined,
              )
              const opfsKey = sessionIdRef.current
                ? `${sessionIdRef.current}::${name}`
                : name
              await deleteOPFSFile(opfsKey)
              delete opfsHandlesRef.current[name]
            } catch (err) {
              console.warn(
                '[Downloader] cleanup error after save for',
                name,
                err,
              )
            }
          }),
        )
      }
    } catch (err) {
      console.error('[Downloader] save-as error:', err)
      setErrorMessage('Failed to save files. Please try again.')
      // Don't clear pendingDownload on error — let user retry
      return
    }

    setPendingDownload(null)
  }, [pendingDownload, uploaderPeerID, verifiedHashes])

  // Auto-reconnect logic

  const attemptAutoReconnectRef = useRef<() => Promise<void>>(async () => {})

  const attemptAutoReconnect = useCallback(async () => {
    // Delegate to the ref so recursive calls are always fresh
    return attemptAutoReconnectRef.current()
  }, [])

  useEffect(() => {
    attemptAutoReconnectRef.current = async () => {
      // Guard: only one reconnect loop at a time
      if (isReconnectingRef.current) return

      if (autoReconnectAttemptsRef.current >= MAX_AUTO_RECONNECT_ATTEMPTS) {
        setIsReconnecting(false)
        isReconnectingRef.current = false
        setIsDownloading(false)
        setErrorMessage(
          'Connection lost and could not be restored. Your progress has been saved — you can resume once reconnected.',
        )
        return
      }

      isReconnectingRef.current = true
      setIsReconnecting(true)
      autoReconnectAttemptsRef.current++

      const delay = RECONNECT_BASE_DELAY_MS * autoReconnectAttemptsRef.current
      console.log(
        `[Downloader] auto-reconnect attempt ${autoReconnectAttemptsRef.current} in ${delay}ms`,
      )
      await new Promise((r) => setTimeout(r, delay))

      const callbacks = connectionCallbacksRef.current
      if (!callbacks) {
        setIsReconnecting(false)
        isReconnectingRef.current = false
        return
      }

      resetInfoPromise()
      const connected = await connect(callbacks)
      if (!connected) {
        console.warn('[Downloader] auto-reconnect failed to connect')
        isReconnectingRef.current = false
        // Retry — call through the ref so the next attempt uses the latest closure
        attemptAutoReconnectRef.current()
        return
      }

      const infoReady = await waitForInfo()
      if (!infoReady) {
        console.warn('[Downloader] auto-reconnect: info not received')
        isReconnectingRef.current = false
        attemptAutoReconnectRef.current()
        return
      }

      // Success — reset counters and resume from current writer offsets
      console.log('[Downloader] auto-reconnect succeeded')
      autoReconnectAttemptsRef.current = 0
      isReconnectingRef.current = false
      setIsReconnecting(false)

      // Re-send Start for every file whose writer is still active
      const writers = activeWritersRef.current
      for (const [fileName, writer] of Object.entries(writers)) {
        if (!writer.finalized) {
          const resumeOffset = writer.nextExpectedOffset
          console.log(
            `[Downloader] re-requesting ${fileName} from offset ${resumeOffset}`,
          )
          safeSend({
            type: MessageType.Start,
            fileName,
            offset: resumeOffset,
          } as z.infer<typeof Message>)
        }
      }
    }
  }, [connect, waitForInfo, resetInfoPromise, safeSend])

  // Stall watchdog
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedBytesPerSecRef = useRef<number | undefined>(speedBytesPerSec)
  useEffect(() => {
    speedBytesPerSecRef.current = speedBytesPerSec
  }, [speedBytesPerSec])

  useEffect(() => {
    if (!isDownloading || isReconnecting || isStreamingModeRef.current) {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
      return
    }

    // Speed is undefined until the first interval tick (1s).
    // Also treat undefined as non-zero so we don't fire on startup.
    if (speedBytesPerSec === undefined || speedBytesPerSec > 0) {
      // Speed is fine — cancel any pending stall timer
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
      return
    }

    // Speed is 0 and we haven't started a stall timer yet
    if (!stallTimerRef.current && firstChunkReceivedRef.current) {
      stallTimerRef.current = setTimeout(() => {
        stallTimerRef.current = null
        if (
          isDownloadingRef.current &&
          !isReconnectingRef.current &&
          !isIntentionalDisconnectRef.current &&
          !isStreamingModeRef.current
        ) {
          console.log('[Downloader] stall detected — attempting auto-reconnect')
          attemptAutoReconnect()
        }
      }, STALL_TIMEOUT_MS)
    }

    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }
    }
  }, [isDownloading, isReconnecting, speedBytesPerSec, attemptAutoReconnect])

  //connection setup

  useEffect(() => {
    if (!uploaderPeerID) return
    resetInfoPromise()

    const callbacks: UploaderConnectionCallbacks = {
      onPasswordRequired: (errMsg) => {
        setIsPasswordRequired(true)
        if (errMsg) setErrorMessage(errMsg)
      },
      onInfo: async (files) => {
        setFilesInfo(files)
        setIsConnected(true)
        setIsPasswordRequired(false)

        const hashes: Record<string, string> = {}
        for (const f of files) {
          if (f.sha256) hashes[f.fileName] = f.sha256
        }
        fileHashesRef.current = hashes

        if (infoResolveRef.current) {
          infoResolveRef.current()
          infoPromiseRef.current = null
          infoResolveRef.current = null
          infoRejectRef.current = null
        }

        try {
          const sessionId = await computeSessionIdFromFiles(files)
          sessionIdRef.current = sessionId
          const results = await Promise.all(
            files.map(async (f) => ({
              fileName: f.fileName,
              offset: await getProgress(uploaderPeerID, f.fileName, sessionId),
            })),
          )
          const offsets: Record<string, number> = {}
          results.forEach(({ fileName, offset }) => {
            offsets[fileName] = offset
          })
          setResumeOffsets(offsets)
        } catch (err) {
          console.warn('[Downloader] failed to load resume offsets:', err)
        }
      },
      onHashUpdate: (fileName, sha256) => {
        console.log(
          `[Downloader] HashUpdate received for ${fileName}: ${sha256}`,
        )
        fileHashesRef.current = { ...fileHashesRef.current, [fileName]: sha256 }
        setFilesInfo((prev) =>
          prev
            ? prev.map((f) => (f.fileName === fileName ? { ...f, sha256 } : f))
            : prev,
        )
      },
      onChunk: (message) => {
        firstChunkReceivedRef.current = true
        processChunkRef.current?.(message)
      },
      onError: (msg) => {
        // If a download is in progress, swallow the error message here —
        // onClose fires right after and will trigger auto-reconnect.
        // Only surface the error if we are NOT actively downloading.
        if (!isDownloadingRef.current || isIntentionalDisconnectRef.current) {
          setErrorMessage(msg)
        } else {
          console.warn(
            '[Downloader] connection error during download (will attempt reconnect):',
            msg,
          )
        }
        setIsConnected(false)
      },
      onClose: () => {
        setIsConnected(false)
        if (infoRejectRef.current) {
          infoRejectRef.current(
            new Error('Connection closed before file info received'),
          )
          infoPromiseRef.current = null
          infoResolveRef.current = null
          infoRejectRef.current = null
        }

        if (
          isDownloadingRef.current &&
          !isIntentionalDisconnectRef.current &&
          !isReconnectingRef.current &&
          !isStreamingModeRef.current
        ) {
          console.log(
            '[Downloader] unexpected connection close during download — attempting auto-reconnect',
          )
          attemptAutoReconnect()
        }
      },
    }

    connectionCallbacksRef.current = callbacks

    connect(callbacks).catch((err) => {
      console.error('[Downloader] failed to connect:', err)
    })

    return () => {
      disconnect()
    }
  }, [
    uploaderPeerID,
    connect,
    disconnect,
    resetInfoPromise,
    attemptAutoReconnect,
  ])

  // submitPassword
  const submitPassword = useCallback(
    (pass: string) => {
      safeSend({ type: MessageType.UsePassword, password: pass } as z.infer<
        typeof Message
      >)
    },
    [safeSend],
  )

  const startDownload = useCallback(async () => {
    if (!filesInfo) return

    // Reconnect if connection was closed by pause
    if (!dataConnectionRef.current?.open) {
      const callbacks = connectionCallbacksRef.current
      if (!callbacks) {
        setErrorMessage('Unable to connect to the uploader. Please try again.')
        return
      }
      resetInfoPromise()
      const connected = await connect(callbacks)
      if (!connected) {
        setErrorMessage('Unable to connect to the uploader. Please try again.')
        return
      }
      const infoReady = await waitForInfo()
      if (!infoReady) {
        setErrorMessage('Unable to receive file information. Please try again.')
        return
      }
    }

    const useOPFS = await hasOPFSWriteSupport()
    const useIDB = !useOPFS && hasIDBSupport()
    if (!useOPFS && !useIDB) {
      setErrorMessage('Your browser does not support the required storage API.')
      return
    }

    if (navigator.storage?.persist) {
      const isPersisted = await navigator.storage.persisted()
      if (!isPersisted) {
        await navigator.storage.persist()
      }
    }

    const totalBytes = filesInfo.reduce((sum, f) => sum + f.size, 0)
    const estimate = await navigator.storage.estimate()
    let available = (estimate.quota ?? 0) - (estimate.usage ?? 0)

    if (!(await hasEnoughQuota(totalBytes))) {
      if (navigator.storage?.persist) {
        const isPersisted = await navigator.storage.persisted()
        if (!isPersisted) {
          await navigator.storage.persist()
          const freshEstimate = await navigator.storage.estimate()
          available = (freshEstimate.quota ?? 0) - (freshEstimate.usage ?? 0)
        }
      }

      if (available < totalBytes) {
        setQuotaExceeded(true)
        return
      }
    }

    setQuotaExceeded(false)
    isStreamingModeRef.current = false
    isIntentionalDisconnectRef.current = false
    autoReconnectAttemptsRef.current = 0
    firstChunkReceivedRef.current = false

    setIsDownloading(true)
    setIsPaused(false)
    setFileErrors({})
    setPendingDownload(null)
    setIsVerifying(false)
    setIsWaitingForUploaderHash(false)
    setHashingProgress({})
    setComputedHashes({})
    completedCountRef.current = 0
    completedFilesRef.current = []
    localHashesRef.current = {}

    if (!sessionIdRef.current) {
      try {
        const filesForId = filesInfo.map((f) => ({
          fileName: f.fileName,
          size: f.size,
          sha256: fileHashesRef.current[f.fileName],
        }))
        sessionIdRef.current = await computeSessionIdFromFiles(filesForId)
      } catch (err) {
        console.warn('[Downloader] failed to compute session id:', err)
        sessionIdRef.current = null
      }
    }

    const offsets: Record<string, number> = {}
    const handles: Record<string, FileSystemFileHandle> = {}
    const writers: Record<string, FileWriter> = {}

    const idbGetters: Record<string, () => Promise<Blob>> = {}

    try {
      await Promise.all(
        filesInfo.map(async (info) => {
          const savedOffset = await getProgress(
            uploaderPeerID,
            info.fileName,
            sessionIdRef.current ?? undefined,
          )
          const opfsKey = sessionIdRef.current
            ? `${sessionIdRef.current}::${info.fileName}`
            : info.fileName

          if (useOPFS) {
            const { writer, handle, resumeOffset } = await openWriter(
              uploaderPeerID,
              info.fileName,
              info.size,
              savedOffset,
              opfsKey,
              sessionIdRef.current,
            )
            offsets[info.fileName] = resumeOffset
            handles[info.fileName] = handle
            writers[info.fileName] = writer
          } else {
            const { writer, getBlob, resumeOffset } = await openIDBWriter(
              uploaderPeerID,
              info.fileName,
              info.size,
              savedOffset,
              opfsKey,
              sessionIdRef.current,
            )
            offsets[info.fileName] = resumeOffset
            idbGetters[info.fileName] = getBlob
            idbGettersRef.current = idbGetters
            writers[info.fileName] = writer
          }
        }),
      )
    } catch (err) {
      console.error('[Downloader] failed to open OPFS writers:', err)
      // Close any writers that successfully opened before the failure
      await Promise.allSettled(
        Object.entries(writers).map(([name, writer]) =>
          closeWriter(writer, name),
        ),
      )
      setErrorMessage(
        'Failed to prepare storage for download. Please try again.',
      )
      setIsDownloading(false)
      return
    }

    opfsHandlesRef.current = handles
    activeWritersRef.current = writers
    setBytesDownloaded(Object.values(offsets).reduce((s, o) => s + o, 0))

    const currentFilesInfo = filesInfo
    const sessionHandles = { ...handles }
    const sessionWriters = { ...writers }

    const onFileComplete = (fileName: string) => {
      delete sessionWriters[fileName]
      completedFilesRef.current = [...completedFilesRef.current, fileName]
      completedCountRef.current++
      if (completedCountRef.current >= currentFilesInfo.length) {
        finalizeDownload(
          completedFilesRef.current,
          sessionWriters,
          sessionHandles,
          currentFilesInfo,
        )
      }
    }

    const onFileError = (fileName: string, reason: string) => {
      delete sessionWriters[fileName]
      setFileErrors((prev) => ({ ...prev, [fileName]: reason }))
      completedCountRef.current++
      if (completedCountRef.current >= currentFilesInfo.length) {
        finalizeDownload(
          completedFilesRef.current,
          sessionWriters,
          sessionHandles,
          currentFilesInfo,
        )
      }
    }

    let nextFileIndex = 0
    const startNextFile = () => {
      if (nextFileIndex >= currentFilesInfo.length) return
      const info = currentFilesInfo[nextFileIndex]
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

    processChunkRef.current = makeProcessChunk({
      writers,
      opfsHandles: handles,
      fileHashesRef,
      filesInfo: currentFilesInfo,
      uploaderPeerID,
      sessionIdRef,
      safeSend,
      setBytesDownloaded,
      onFileTransferComplete: () => {
        startNextFile()
      },
      onFileComplete: (fileName) => {
        onFileComplete(fileName)
      },
      onFileError: (fileName, reason) => {
        onFileError(fileName, reason)
        startNextFile()
      },
    })

    startNextFile()
  }, [
    filesInfo,
    uploaderPeerID,
    safeSend,
    connect,
    waitForInfo,
    resetInfoPromise,
    finalizeDownload,
    dataConnectionRef,
  ])

  const startStreamingDownload = useCallback(async () => {
    if (!filesInfo) return

    // Ensure connection is open
    if (!dataConnectionRef.current?.open) {
      const callbacks = connectionCallbacksRef.current
      if (!callbacks) {
        setErrorMessage('Unable to connect to the uploader. Please try again.')
        return
      }
      resetInfoPromise()
      const connected = await connect(callbacks)
      if (!connected) {
        setErrorMessage('Unable to connect to the uploader. Please try again.')
        return
      }
      const infoReady = await waitForInfo()
      if (!infoReady) {
        setErrorMessage('Unable to receive file information. Please try again.')
        return
      }
    }

    const currentFilesInfo = filesInfo
    const isMulti = currentFilesInfo.length > 1

    let singleController: SingleFileStreamController | null = null
    let multiController: MultiFileStreamController | null = null

    try {
      const onSinkAborted = () => {
        if (!isStreamingModeRef.current) return
        console.log('[Downloader] sink aborted — stopping transfer')
        // Marked as intentional BEFORE closing the connection so that the
        // synchronous onClose callback doesn't trigger auto-reconnect.
        isIntentionalDisconnectRef.current = true
        isDownloadingRef.current = false
        isStreamingModeRef.current = false
        setIsStreamingDownload(false)
        singleStreamControllerRef.current = null
        multiStreamControllerRef.current = null
        processChunkRef.current = null
        safeSend({ type: MessageType.Pause } as z.infer<typeof Message>)
        const conn = dataConnectionRef.current
        if (conn?.open) conn.close()
        // Reset the intentional flag after the close event has had a chance
        // to fire (it's synchronous in PeerJS but we use setTimeout to be safe)
        setTimeout(() => {
          isIntentionalDisconnectRef.current = false
        }, 0)
        setIsDownloading(false)
        setRotating(false)
        setQuotaExceeded(false)
      }

      if (isMulti) {
        multiController = await openMultiFileZipStream(
          getZipFilename(),
          onSinkAborted,
        )
        // Begin the first file's zip entry immediately
        multiController.beginFile(currentFilesInfo[0].fileName)
      } else {
        const info = currentFilesInfo[0]
        singleController = await openSingleFileStream(
          info.fileName,
          info.size,
          onSinkAborted,
        )
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the file picker — don't set an error, just bail
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`Could not open download destination: ${msg}`)
      return
    }

    isStreamingModeRef.current = true
    singleStreamControllerRef.current = singleController
    multiStreamControllerRef.current = multiController
    streamingBytesWrittenRef.current = {}

    setIsStreamingDownload(true)
    setQuotaExceeded(false)
    setIsDownloading(true)
    setIsPaused(false)
    setFileErrors({})
    setPendingDownload(null)
    setIsVerifying(false)
    setIsWaitingForUploaderHash(false)
    setHashingProgress({})
    setComputedHashes({})
    completedCountRef.current = 0
    completedFilesRef.current = []
    setBytesDownloaded(0)

    let nextFileIndex = 1 // index 0 already started
    const bytesWrittenPerFile = streamingBytesWrittenRef.current

    const onFileComplete = (fileName: string) => {
      completedFilesRef.current = [...completedFilesRef.current, fileName]
      completedCountRef.current++

      if (completedCountRef.current >= currentFilesInfo.length) {
        // All done — finalize zip if multi
        if (multiController) {
          multiController.finalize()
        }
        safeSend({ type: MessageType.Done } as z.infer<typeof Message>)
        setDone(true)
        setIsDownloading(false)
        setRotating(false)
        isStreamingModeRef.current = false
        setIsStreamingDownload(false)
        singleStreamControllerRef.current = null
        multiStreamControllerRef.current = null
      }
    }

    const onFileError = (fileName: string, reason: string) => {
      setFileErrors((prev) => ({ ...prev, [fileName]: reason }))
      completedCountRef.current++

      // Mark intentional and update the ref directly before closing the
      // connection so onClose doesn't trigger auto-reconnect.
      isIntentionalDisconnectRef.current = true
      isDownloadingRef.current = false
      isStreamingModeRef.current = false
      setIsStreamingDownload(false)
      singleStreamControllerRef.current = null
      multiStreamControllerRef.current = null
      processChunkRef.current = null

      singleController?.abort(reason).catch(() => {})
      multiController?.abort(reason).catch(() => {})

      safeSend({ type: MessageType.Pause } as z.infer<typeof Message>)
      const conn = dataConnectionRef.current
      if (conn?.open) conn.close()
      setTimeout(() => {
        isIntentionalDisconnectRef.current = false
      }, 0)

      setIsDownloading(false)
      setRotating(false)
      setErrorMessage(`Download failed: ${reason}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onFileTransferComplete = (fileName: string) => {
      if (!isMulti || nextFileIndex >= currentFilesInfo.length) return
      // Begin next zip entry before requesting next file
      const nextFile = currentFilesInfo[nextFileIndex]
      multiController!.beginFile(nextFile.fileName)
      // Request next file from uploader
      safeSend({
        type: MessageType.Start,
        fileName: nextFile.fileName,
        offset: 0,
      } as z.infer<typeof Message>)
      nextFileIndex++
    }

    processChunkRef.current = makeProcessChunkStreaming({
      filesInfo: currentFilesInfo,
      singleController,
      multiController,
      safeSend,
      setBytesDownloaded,
      onFileTransferComplete,
      onFileComplete,
      onFileError,
      bytesWrittenPerFile,
    })

    // Request the first file (offset 0 — no resume on streaming path)
    safeSend({
      type: MessageType.Start,
      fileName: currentFilesInfo[0].fileName,
      offset: 0,
    } as z.infer<typeof Message>)
  }, [
    filesInfo,
    safeSend,
    connect,
    waitForInfo,
    resetInfoPromise,
    dataConnectionRef,
  ])

  // pauseDownload

  const pauseDownload = useCallback(async () => {
    isIntentionalDisconnectRef.current = true
    setIsDownloading(false)
    setIsPaused(true)
    await flushAndCloseAllWriters()

    if (dataConnectionRef.current) {
      safeSend({ type: MessageType.Pause } as z.infer<typeof Message>)
      const conn = dataConnectionRef.current
      dataConnectionRef.current = null
      conn.close()
    }

    isIntentionalDisconnectRef.current = false
    processChunkRef.current = null
    localHashPromisesRef.current = {}

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
    } catch (err) {
      console.warn('[Downloader] failed to load resume offsets on pause:', err)
    }
  }, [safeSend, uploaderPeerID, flushAndCloseAllWriters, dataConnectionRef])

  // stopDownload

  const stopDownload = useCallback(async () => {
    isIntentionalDisconnectRef.current = true
    await flushAndCloseAllWriters()

    if (dataConnectionRef.current) {
      safeSend({ type: MessageType.Pause } as z.infer<typeof Message>)
      const conn = dataConnectionRef.current
      dataConnectionRef.current = null
      conn.close()
    }

    isIntentionalDisconnectRef.current = false

    // Abort streaming controllers if active
    if (isStreamingModeRef.current) {
      singleStreamControllerRef.current
        ?.abort('User stopped download')
        .catch(() => {})
      multiStreamControllerRef.current
        ?.abort('User stopped download')
        .catch(() => {})
      isStreamingModeRef.current = false
      setIsStreamingDownload(false)
      singleStreamControllerRef.current = null
      multiStreamControllerRef.current = null
    }

    await clearAllOPFSData()

    setIsDownloading(false)
    setIsPaused(false)
    setDone(false)
    setBytesDownloaded(0)
    setResumeOffsets({})
    setErrorMessage(null)
    setFileErrors({})
    setRotating(false)
    setVerifiedHashes({})
    setHashingProgress({})
    setIsWaitingForUploaderHash(false)
    setPendingDownload(null)
    setQuotaExceeded(false)
    setIsReconnecting(false)
    isReconnectingRef.current = false
    autoReconnectAttemptsRef.current = 0
    firstChunkReceivedRef.current = false
    localHashesRef.current = {}
    completedCountRef.current = 0
    completedFilesRef.current = []
  }, [safeSend, flushAndCloseAllWriters, clearAllOPFSData, dataConnectionRef])

  const readPasteBlob = useCallback(async (): Promise<string | null> => {
    const PASTE_FILENAME = '___pasted___.txt'
    try {
      const handle = opfsHandlesRef.current[PASTE_FILENAME]
      if (handle) {
        const file = await handle.getFile()
        return await file.text()
      }
      const getter = idbGettersRef.current[PASTE_FILENAME]
      if (getter) {
        const blob = await getter()
        return await blob.text()
      }
      return null
    } catch {
      return null
    }
  }, [])

  const statRecordedRef = useRef(false)

  useEffect(() => {
    if (!isDone || !filesInfo) return
    if (statRecordedRef.current) return
    statRecordedRef.current = true

    const totalBytes = filesInfo.reduce((acc, f) => acc + f.size, 0)
    fetch('/api/stats/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bytes: totalBytes }),
    }).catch(() => {})
  }, [isDone, filesInfo])

  return {
    filesInfo,
    isConnected,
    isPasswordRequired,
    isDownloading,
    isPaused,
    isDone,
    errorMessage,
    fileErrors,
    resumeOffsets,
    submitPassword,
    startDownload,
    pauseDownload,
    stopDownload,
    saveFiles,
    totalSize: filesInfo?.reduce((acc, f) => acc + f.size, 0) ?? 0,
    bytesDownloaded,
    verifiedHashes,
    computedHashes,
    isVerifying,
    speedBytesPerSec,
    etaSeconds,
    isWaitingForUploaderHash,
    hashingProgress,
    hasPendingDownload: pendingDownload !== null,
    readPasteBlob,
    quotaExceeded,
    startStreamingDownload,
    isReconnecting,
    isStreamingDownload,
  }
}
