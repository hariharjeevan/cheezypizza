import { useState, useEffect, useRef } from 'react'
import Peer, { DataConnection } from 'peerjs'
import {
  UploadedFile,
  UploaderConnection,
  UploaderConnectionStatus,
} from '../types'
import {
  decodeMessage,
  Message,
  MessageType,
  ChunkAckMessage,
} from '../messages'
import { z } from 'zod'
import { getFileName } from '../fs'

export const MAX_CHUNK_SIZE = 32 * 1024 // 32 KB

type GlobalThisWithCrypto = {
  crypto?: Crypto
}

function getSubtleCrypto(): SubtleCrypto | null {
  const cryptoObj =
    (globalThis as unknown as GlobalThisWithCrypto).crypto ?? null
  return cryptoObj?.subtle ?? null
}

async function computeFileSHA256(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const subtle = getSubtleCrypto()
  if (!subtle) {
    throw new Error(
      'Web Crypto API unavailable: crypto.subtle is not supported',
    )
  }
  const digest = await subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Cache so reconnects / re-renders don't re-hash the same files.
// Use a Map keyed by file identity (name + size + lastModified when available)
// because File/Blob object references can change across renders.
const sha256CacheByKey = new Map<string, string>()

function makeFileCacheKey(file: UploadedFile): string {
  const name = getFileName(file)
  // Some File objects expose `lastModified`; include it when present to
  // avoid collisions for same-name files with different contents.
  // @ts-ignore
  const lastModified =
    typeof file.lastModified === 'number' ? file.lastModified : 0
  return `${name}::${file.size}::${lastModified}`
}

async function getOrComputeSHA256(file: UploadedFile): Promise<string> {
  const key = makeFileCacheKey(file)
  const cached = sha256CacheByKey.get(key)
  if (cached) return cached
  const hash = await computeFileSHA256(file)
  sha256CacheByKey.set(key, hash)
  return hash
}

async function buildFileInfo(
  files: UploadedFile[],
): Promise<
  Array<{ fileName: string; size: number; type: string; sha256: string }>
> {
  return Promise.all(
    files.map(async (f) => ({
      fileName: getFileName(f),
      size: f.size,
      type: f.type,
      sha256: await getOrComputeSHA256(f),
    })),
  )
}
const WINDOW_SIZE = 8

export function isFinalChunk(end: number, fileSize: number): boolean {
  return end === fileSize
}

function validateOffset(
  files: UploadedFile[],
  fileName: string,
  offset: number,
): UploadedFile {
  const validFile = files.find(
    (file) => getFileName(file) === fileName && offset <= file.size,
  )
  if (!validFile) {
    throw new Error('invalid file offset')
  }
  return validFile
}

function safeSendOnConn(
  conn: DataConnection,
  message: Message,
  context: string,
): void {
  if (!conn.open) {
    console.warn(`[${context}] send skipped, connection not open`)
    return
  }
  try {
    conn.send(message)
  } catch (err) {
    console.warn(`[${context}] send threw:`, err)
  }
}

export function useUploaderConnections(
  peer: Peer,
  files: UploadedFile[],
  password: string,
): {
  connections: Array<UploaderConnection>
  fileInfo: Array<{
    fileName: string
    size: number
    type: string
    sha256: string
  }> | null
} {
  const [connections, setConnections] = useState<Array<UploaderConnection>>([])
  const [fileInfo, setFileInfo] = useState<Array<{
    fileName: string
    size: number
    type: string
    sha256: string
  }> | null>(null)

  const connectionsRef = useRef<Array<UploaderConnection>>(connections)
  useEffect(() => {
    connectionsRef.current = connections
  }, [connections])

  useEffect(() => {
    console.log(
      '[UploaderConnections] initializing with',
      files.length,
      'files',
    )
    setFileInfo(null)
    let cancelled = false
    // Precompute file info (including SHA-256) once per uploader session so
    // subsequent reconnects or resume attempts reuse the same hashes and
    // do not change the session id.
    const fileInfoPromise = buildFileInfo(files)

    fileInfoPromise
      .then((info) => {
        if (!cancelled) setFileInfo(info)
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(
            '[UploaderConnections] failed to compute file info:',
            err,
          )
        }
      })

    const cleanupHandlers: Array<() => void> = []

    const listener = (conn: DataConnection) => {
      console.log('[UploaderConnections] new connection from peer', conn.peer)
      // If the connection is a report, we need to hard-redirect the uploader to the reported page to prevent them from uploading more files.
      if (conn.metadata?.type === 'report') {
        console.log(
          '[UploaderConnections] received report connection, redirecting',
        )
        // Broadcast report message to all connections
        connectionsRef.current.forEach((c) => {
          c.dataConnection.send({
            type: MessageType.Report,
          })
          c.dataConnection.close()
        })

        // Hard-redirect uploader to reported page
        window.location.href = '/reported'
        return
      }

      let currentFileName: string | null = null
      let nextOffset = 0
      let outstandingChunks = 0
      let finalChunkSent = false
      let paused = false
      let sendWindow: (() => void) | null = null

      const newConn = {
        status: UploaderConnectionStatus.Pending,
        dataConnection: conn,
        completedFiles: 0,
        totalFiles: files.length,
        currentFileProgress: 0,
        acknowledgedBytes: 0,
      }

      setConnections((conns) => {
        const withoutOld = conns.filter(
          (c) => c.dataConnection.peer !== conn.peer,
        )
        return [newConn, ...withoutOld]
      })

      const updateConnection = (
        fn: (c: UploaderConnection) => UploaderConnection,
      ) => {
        setConnections((conns) =>
          conns.map((c) => (c.dataConnection === conn ? fn(c) : c)),
        )
      }

      const onData = (data: unknown): void => {
        try {
          const message = decodeMessage(data)
          console.log('[UploaderConnections] received message:', message.type)
          switch (message.type) {
            case MessageType.RequestInfo: {
              console.log('[UploaderConnections] client info:', {
                browser: `${message.browserName} ${message.browserVersion}`,
                os: `${message.osName} ${message.osVersion}`,
                mobile: message.mobileVendor
                  ? `${message.mobileVendor} ${message.mobileModel}`
                  : 'N/A',
              })
              const newConnectionState = {
                browserName: message.browserName,
                browserVersion: message.browserVersion,
                osName: message.osName,
                osVersion: message.osVersion,
                mobileVendor: message.mobileVendor,
                mobileModel: message.mobileModel,
              }

              if (password) {
                console.log(
                  '[UploaderConnections] password required, requesting authentication',
                )

                safeSendOnConn(
                  conn,
                  { type: MessageType.PasswordRequired } as Message,
                  'UploaderConnections/PasswordRequired',
                )

                updateConnection((draft) => {
                  if (draft.status !== UploaderConnectionStatus.Pending) {
                    return draft
                  }

                  return {
                    ...draft,
                    ...newConnectionState,
                    status: UploaderConnectionStatus.Authenticating,
                  }
                })

                return
              }

              updateConnection((draft) => {
                if (draft.status !== UploaderConnectionStatus.Pending) {
                  return draft
                }

                return {
                  ...draft,
                  ...newConnectionState,
                  status: UploaderConnectionStatus.Ready,
                }
              })
              ;(async () => {
                try {
                  const fileInfo = await fileInfoPromise
                  console.log(
                    '[UploaderConnections] sending file info with hashes',
                  )

                  safeSendOnConn(
                    conn,
                    { type: MessageType.Info, files: fileInfo } as Message,
                    'UploaderConnections/Info',
                  )
                } catch (err) {
                  console.error(
                    '[UploaderConnections] failed to build file info:',
                    err,
                  )
                }
              })()
              break
            }

            case MessageType.UsePassword: {
              console.log('[UploaderConnections] password attempt received')
              const { password: submittedPassword } = message
              if (submittedPassword === password) {
                console.log('[UploaderConnections] password correct')
                updateConnection((draft) => {
                  if (
                    draft.status !== UploaderConnectionStatus.Authenticating &&
                    draft.status !== UploaderConnectionStatus.InvalidPassword
                  ) {
                    return draft
                  }

                  return {
                    ...draft,
                    status: UploaderConnectionStatus.Ready,
                  }
                })
                ;(async () => {
                  try {
                    const fileInfo = await fileInfoPromise
                    console.log(
                      '[UploaderConnections] sending file info with hashes (post-auth)',
                    )

                    safeSendOnConn(
                      conn,
                      { type: MessageType.Info, files: fileInfo } as Message,
                      'UploaderConnections/Info(post-auth)',
                    )
                  } catch (err) {
                    console.error(
                      '[UploaderConnections] failed to build file info:',
                      err,
                    )
                  }
                })()
              } else {
                console.log('[UploaderConnections] password incorrect')
                updateConnection((draft) => {
                  if (
                    draft.status !== UploaderConnectionStatus.Authenticating
                  ) {
                    return draft
                  }

                  return {
                    ...draft,
                    status: UploaderConnectionStatus.InvalidPassword,
                  }
                })

                safeSendOnConn(
                  conn,
                  {
                    type: MessageType.PasswordRequired,
                    errorMessage: 'Invalid password',
                  } as Message,
                  'UploaderConnections/InvalidPassword',
                )
              }
              break
            }

            case MessageType.Start: {
              const fileName = message.fileName
              const offset = message.offset
              console.log(
                '[UploaderConnections] starting transfer of',
                fileName,
                'from offset',
                offset,
              )
              const file = validateOffset(files, fileName, offset)

              currentFileName = fileName
              nextOffset = offset
              outstandingChunks = 0
              finalChunkSent = false
              paused = false

              sendWindow = () => {
                while (
                  !paused &&
                  !finalChunkSent &&
                  outstandingChunks < WINDOW_SIZE
                ) {
                  if (!conn.open) {
                    console.warn(
                      '[UploaderConnections] sendWindow aborted, connection closed',
                    )
                    paused = true
                    return
                  }

                  const end = Math.min(file.size, nextOffset + MAX_CHUNK_SIZE)
                  const final = isFinalChunk(end, file.size)
                  const chunkOffset = nextOffset
                  const chunkIndex = outstandingChunks + 1

                  // Log for e2e testing
                  console.log(
                    `[UploaderConnections] sending chunk ${chunkIndex} for ${fileName} (${chunkOffset}-${end}/${file.size}) final=${final}`,
                  )

                  const request: Message = {
                    type: MessageType.Chunk,
                    fileName,
                    offset: chunkOffset,
                    bytes: file.slice(chunkOffset, end),
                    final,
                  }

                  if (!conn.open) {
                    console.warn(
                      '[UploaderConnections] sendWindow: conn closed before send',
                    )
                    paused = true
                    return
                  }
                  try {
                    conn.send(request)
                  } catch (err) {
                    console.warn(
                      '[UploaderConnections] sendWindow send threw, pausing:',
                      err,
                    )
                    paused = true
                    return
                  }

                  outstandingChunks++
                  nextOffset = end

                  if (final) {
                    finalChunkSent = true
                  }
                }
              }

              updateConnection((draft) => {
                if (
                  draft.status !== UploaderConnectionStatus.Ready &&
                  draft.status !== UploaderConnectionStatus.Paused
                ) {
                  return draft
                }

                const updated = {
                  ...draft,
                  status: UploaderConnectionStatus.Uploading,
                  uploadingFileName: fileName,
                  uploadingOffset: nextOffset,
                  acknowledgedBytes: offset,
                  currentFileProgress: file.size > 0 ? offset / file.size : 0,
                }

                sendWindow?.()
                return updated
              })

              break
            }

            case MessageType.Pause: {
              console.log('[UploaderConnections] transfer paused')
              paused = true
              updateConnection((draft) => {
                if (draft.status !== UploaderConnectionStatus.Uploading) {
                  return draft
                }

                return {
                  ...draft,
                  status: UploaderConnectionStatus.Paused,
                }
              })
              break
            }

            case MessageType.ChunkAck: {
              const ackMessage = message as z.infer<typeof ChunkAckMessage>
              console.log(
                '[UploaderConnections] received chunk ack:',
                ackMessage.fileName,
                'offset',
                ackMessage.offset,
                'bytes',
                ackMessage.bytesReceived,
              )

              if (ackMessage.fileName === currentFileName) {
                outstandingChunks = Math.max(0, outstandingChunks - 1)
              }

              updateConnection((draft) => {
                const currentAcked = draft.acknowledgedBytes || 0
                const file = files.find(
                  (f) => getFileName(f) === ackMessage.fileName,
                )
                const maxAcked = file?.size ?? Number.MAX_SAFE_INTEGER
                const newAcked = Math.min(
                  currentAcked + ackMessage.bytesReceived,
                  maxAcked,
                )

                if (file) {
                  const acknowledgedProgress = newAcked / file.size
                  return {
                    ...draft,
                    acknowledgedBytes: newAcked,
                    currentFileProgress: acknowledgedProgress,
                  }
                }

                return {
                  ...draft,
                  acknowledgedBytes: newAcked,
                }
              })

              if (ackMessage.fileName === currentFileName) {
                if (!paused) {
                  sendWindow?.()
                }

                if (finalChunkSent && outstandingChunks === 0) {
                  updateConnection((draft) => ({
                    ...draft,
                    status: UploaderConnectionStatus.Ready,
                    completedFiles: draft.completedFiles + 1,
                    currentFileProgress: 0,
                  }))
                }
              }
              break
            }

            case MessageType.Done: {
              console.log(
                '[UploaderConnections] transfer completed successfully',
              )
              updateConnection((draft) => {
                if (draft.status !== UploaderConnectionStatus.Ready) {
                  return draft
                }

                conn.close()
                return {
                  ...draft,
                  status: UploaderConnectionStatus.Done,
                }
              })
              break
            }
          }
        } catch (err) {
          console.error('[UploaderConnections] error handling message:', err)
        }
      }

      const onClose = (): void => {
        console.log('[UploaderConnections] connection closed')

        paused = true

        updateConnection((draft) => {
          if (
            [
              UploaderConnectionStatus.InvalidPassword,
              UploaderConnectionStatus.Done,
            ].includes(draft.status)
          ) {
            return draft
          }

          return {
            ...draft,
            status: UploaderConnectionStatus.Closed,
          }
        })
      }

      conn.on('data', onData)
      conn.on('close', onClose)

      cleanupHandlers.push(() => {
        conn.off('data', onData)
        conn.off('close', onClose)
        conn.close()
      })
    }

    peer.on('connection', listener)

    return () => {
      console.log('[UploaderConnections] cleaning up connections')
      cancelled = true
      peer.off('connection', listener)
      cleanupHandlers.forEach((fn) => fn())
    }
  }, [peer, files, password])

  return { connections, fileInfo }
}
