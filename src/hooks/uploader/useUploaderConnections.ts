import { useState, useEffect, useRef } from 'react'
import Peer, { DataConnection } from 'peerjs'
import {
  UploadedFile,
  UploaderConnection,
  UploaderConnectionStatus,
} from '../../types'
import {
  decodeMessage,
  Message,
  MessageType,
  ChunkAckMessage,
} from '../../messages'
import { z } from 'zod'
import { getFileName } from '../../fs'
import { buildFileInfoImmediate, computeHashByName } from './fileInfo'
import {
  createSenderState,
  clearBufferedAmountLowListener,
  runSendWindow,
  validateOffset,
  safeSendOnConn,
} from './sender'

const PROGRESS_INTERVAL_MS = 250

function waitForBufferDrain(conn: DataConnection): Promise<void> {
  return new Promise((resolve) => {
    const dc = (conn as unknown as { dataChannel: RTCDataChannel | null })
      .dataChannel
    if (!dc || dc.bufferedAmount === 0) {
      resolve()
      return
    }
    const check = () => {
      if (dc.bufferedAmount === 0) {
        resolve()
      } else {
        setTimeout(check, 100)
      }
    }
    setTimeout(check, 100)
  })
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
    sha256: string | undefined
    hashProgress?: number
  }> | null
} {
  const [connections, setConnections] = useState<Array<UploaderConnection>>([])
  const [fileInfo, setFileInfo] = useState<Array<{
    fileName: string
    size: number
    type: string
    sha256: string | undefined
    hashProgress?: number
  }> | null>(null)

  const connectionsRef = useRef<Array<UploaderConnection>>(connections)
  useEffect(() => {
    connectionsRef.current = connections
  }, [connections])

  const resolvedHashesRef = useRef<Record<string, string>>({})

  useEffect(() => {
    console.log(
      '[UploaderConnections] initializing with',
      files.length,
      'files',
    )
    setFileInfo(null)
    resolvedHashesRef.current = {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let cancelled = false

    const immediateInfo = buildFileInfoImmediate(files)
    setFileInfo(immediateInfo.map((fi) => ({ ...fi, sha256: undefined })))

    const cleanupHandlers: Array<() => void> = []
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

    const listener = (conn: DataConnection) => {
      console.log('[UploaderConnections] new connection from peer', conn.peer)

      if (conn.metadata?.type === 'report') {
        console.log('[UploaderConnections] received report, redirecting')
        connectionsRef.current.forEach((c) => {
          c.dataConnection.send({ type: MessageType.Report })
          c.dataConnection.close()
        })
        window.location.href = '/reported'
        return
      }

      const sender = createSenderState()
      const ackedBytesRef = { current: 0 }
      const bytesTransferredRef = { current: 0 }
      const speedBpsRef = { current: 0 }
      let emaSpeed: number | null = null
      let emaSamples = 0
      let lastEmaBytes = 0
      let lastEmaTime = Date.now()

      const updateConnection = (
        fn: (c: UploaderConnection) => UploaderConnection,
      ) => {
        setConnections((conns) =>
          conns.map((c) => (c.dataConnection === conn ? fn(c) : c)),
        )
      }

      const progressInterval = setInterval(() => {
        const now = Date.now()
        const elapsed = (now - lastEmaTime) / 1000
        const delta = ackedBytesRef.current - lastEmaBytes
        lastEmaBytes = ackedBytesRef.current
        lastEmaTime = now

        if (elapsed > 0 && delta >= 0) {
          const instant = delta / elapsed
          emaSpeed =
            emaSpeed === null ? instant : 0.4 * instant + 0.6 * emaSpeed
          emaSamples++
        }

        const speedBps = emaSamples >= 2 ? (emaSpeed ?? 0) : 0
        speedBpsRef.current = speedBps

        setConnections((conns) =>
          conns.map((c) => {
            if (c.dataConnection !== conn) return c
            const newAcked = ackedBytesRef.current
            const file = files.find(
              (f) => getFileName(f) === sender.currentFileName,
            )
            const fileProgress =
              file && file.size > 0
                ? Math.min(newAcked / file.size, 1)
                : c.currentFileProgress
            if (
              c.acknowledgedBytes === newAcked &&
              c.currentFileProgress === fileProgress &&
              c.bytesTransferred === bytesTransferredRef.current &&
              c.speedBytesPerSec === speedBps
            )
              return c
            const remaining = (file?.size ?? 0) - newAcked
            const eta =
              speedBps > 1024 && remaining > 0 ? remaining / speedBps : null
            return {
              ...c,
              acknowledgedBytes: newAcked,
              currentFileProgress: fileProgress,
              uploadingFileSize: file?.size,
              bytesTransferred: bytesTransferredRef.current,
              speedBytesPerSec: speedBps,
              etaSeconds: eta ?? undefined,
            }
          }),
        )
      }, PROGRESS_INTERVAL_MS)

      const stopProgress = () => clearInterval(progressInterval)

      const resetEMA = () => {
        emaSpeed = null
        emaSamples = 0
        lastEmaBytes = ackedBytesRef.current
        lastEmaTime = Date.now()
      }

      setConnections((conns) => {
        const withoutOld = conns.filter(
          (c) => c.dataConnection.peer !== conn.peer,
        )
        return [
          {
            status: UploaderConnectionStatus.Pending,
            dataConnection: conn,
            completedFiles: 0,
            totalFiles: files.length,
            bytesTransferred: 0,
            totalBytes,
            currentFileProgress: 0,
            uploadingFileSize: undefined,
            acknowledgedBytes: 0,
            speedBytesPerSec: undefined,
            etaSeconds: undefined,
          },
          ...withoutOld,
        ]
      })

      const sendInfoAndKnownHashes = () => {
        safeSendOnConn(
          conn,
          { type: MessageType.Info, files: immediateInfo } as Message,
          'Info',
        )

        Object.entries(resolvedHashesRef.current).forEach(
          ([fileName, sha256]) => {
            safeSendOnConn(
              conn,
              { type: MessageType.HashUpdate, fileName, sha256 } as Message,
              'HashUpdate(catch-up)',
            )
          },
        )
      }

      const onData = (data: unknown): void => {
        try {
          const message = decodeMessage(data)
          switch (message.type) {
            case MessageType.RequestInfo: {
              const state = {
                browserName: message.browserName,
                browserVersion: message.browserVersion,
                osName: message.osName,
                osVersion: message.osVersion,
                mobileVendor: message.mobileVendor,
                mobileModel: message.mobileModel,
              }
              if (password) {
                safeSendOnConn(
                  conn,
                  { type: MessageType.PasswordRequired } as Message,
                  'PasswordRequired',
                )
                updateConnection((d) =>
                  d.status !== UploaderConnectionStatus.Pending
                    ? d
                    : {
                        ...d,
                        ...state,
                        status: UploaderConnectionStatus.Authenticating,
                      },
                )
                return
              }
              updateConnection((d) =>
                d.status !== UploaderConnectionStatus.Pending
                  ? d
                  : { ...d, ...state, status: UploaderConnectionStatus.Ready },
              )
              sendInfoAndKnownHashes()
              break
            }

            case MessageType.UsePassword: {
              if (message.password === password) {
                updateConnection((d) =>
                  d.status !== UploaderConnectionStatus.Authenticating &&
                  d.status !== UploaderConnectionStatus.InvalidPassword
                    ? d
                    : { ...d, status: UploaderConnectionStatus.Ready },
                )
                sendInfoAndKnownHashes()
              } else {
                updateConnection((d) =>
                  d.status !== UploaderConnectionStatus.Authenticating
                    ? d
                    : {
                        ...d,
                        status: UploaderConnectionStatus.InvalidPassword,
                      },
                )
                safeSendOnConn(
                  conn,
                  {
                    type: MessageType.PasswordRequired,
                    errorMessage: 'Invalid password',
                  } as Message,
                  'InvalidPassword',
                )
              }
              break
            }

            case MessageType.Start: {
              const { fileName, offset } = message
              validateOffset(files, fileName, offset)
              sender.currentFileName = fileName
              sender.nextOffset = offset
              sender.finalChunkSent = false
              sender.paused = false
              ackedBytesRef.current = offset
              resetEMA()

              clearBufferedAmountLowListener(conn, sender)

              const file = files.find((f) => getFileName(f) === fileName)!
              updateConnection((d) => {
                if (
                  d.status !== UploaderConnectionStatus.Ready &&
                  d.status !== UploaderConnectionStatus.Paused
                )
                  return d
                return {
                  ...d,
                  status: UploaderConnectionStatus.Uploading,
                  uploadingFileName: fileName,
                  uploadingFileSize: file.size,
                  uploadingOffset: offset,
                  acknowledgedBytes: offset,
                  currentFileProgress: file.size > 0 ? offset / file.size : 0,
                }
              })
              runSendWindow(conn, files, sender)
              break
            }

            case MessageType.Pause: {
              sender.paused = true
              clearBufferedAmountLowListener(conn, sender)
              resetEMA()
              updateConnection((d) =>
                d.status !== UploaderConnectionStatus.Uploading
                  ? d
                  : { ...d, status: UploaderConnectionStatus.Paused },
              )
              break
            }

            case MessageType.ChunkAck: {
              const ack = message as z.infer<typeof ChunkAckMessage>
              const file = files.find((f) => getFileName(f) === ack.fileName)

              if (ack.fileName === sender.currentFileName) {
                const cap = file?.size ?? Number.MAX_SAFE_INTEGER
                ackedBytesRef.current = Math.min(
                  ackedBytesRef.current + ack.bytesReceived,
                  cap,
                )
              } else {
                break
              }

              if (
                sender.finalChunkSent &&
                ackedBytesRef.current >= (file?.size ?? 0)
              ) {
                const fileName = ack.fileName
                bytesTransferredRef.current += file?.size ?? 0
                ackedBytesRef.current = 0
                stopProgress()
                setConnections((conns) =>
                  conns.map((c) => {
                    if (c.dataConnection !== conn) return c
                    return {
                      ...c,
                      status: UploaderConnectionStatus.Ready,
                      completedFiles: c.completedFiles + 1,
                      bytesTransferred: bytesTransferredRef.current,
                      uploadingFileName: undefined,
                      uploadingFileSize: undefined,
                      uploadingOffset: undefined,
                      currentFileProgress: 0,
                      acknowledgedBytes: 0,
                      speedBytesPerSec: undefined,
                      etaSeconds: undefined,
                    }
                  }),
                )
                waitForBufferDrain(conn)
                  .then(() =>
                    computeHashByName(fileName, files, (progress) => {
                      setFileInfo((prev) => {
                        if (!prev) return prev
                        return prev.map((fi) =>
                          fi.fileName === fileName
                            ? { ...fi, hashProgress: progress }
                            : fi,
                        )
                      })
                    }),
                  )
                  .then((sha256) => {
                    if (!sha256) return
                    resolvedHashesRef.current[fileName] = sha256
                    connectionsRef.current.forEach((c) => {
                      if (
                        c.dataConnection.open &&
                        c.status !== UploaderConnectionStatus.Done &&
                        c.status !== UploaderConnectionStatus.Closed &&
                        c.status !== UploaderConnectionStatus.InvalidPassword
                      ) {
                        safeSendOnConn(
                          c.dataConnection,
                          {
                            type: MessageType.HashUpdate,
                            fileName,
                            sha256,
                          } as Message,
                          'HashUpdate',
                        )
                      }
                    })
                    setFileInfo((prev) => {
                      if (!prev) return prev
                      return prev.map((fi) =>
                        fi.fileName === fileName
                          ? { ...fi, sha256, hashProgress: undefined }
                          : fi,
                      )
                    })
                  })
              }
              break
            }

            case MessageType.Done: {
              stopProgress()
              updateConnection((d) => {
                if (d.status !== UploaderConnectionStatus.Ready) return d
                conn.close()
                return { ...d, status: UploaderConnectionStatus.Done }
              })
              break
            }
          }
        } catch (err) {
          console.error('[UploaderConnections] error handling message:', err)
        }
      }

      const onClose = (): void => {
        sender.paused = true
        stopProgress()
        clearBufferedAmountLowListener(conn, sender)
        updateConnection((d) => {
          if (
            [
              UploaderConnectionStatus.InvalidPassword,
              UploaderConnectionStatus.Done,
            ].includes(d.status)
          )
            return d
          return { ...d, status: UploaderConnectionStatus.Closed }
        })
      }

      conn.on('data', onData)
      conn.on('close', onClose)

      cleanupHandlers.push(() => {
        stopProgress()
        clearBufferedAmountLowListener(conn, sender)
        conn.off('data', onData)
        conn.off('close', onClose)
        conn.close()
      })
    }

    peer.on('connection', listener)
    return () => {
      cancelled = true
      peer.off('connection', listener)
      cleanupHandlers.forEach((fn) => fn())
    }
  }, [peer, files, password])

  return { connections, fileInfo }
}
