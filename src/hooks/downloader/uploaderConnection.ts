import { useCallback, useRef } from 'react'
import { DataConnection } from 'peerjs'
import { z } from 'zod'
import { useWebRTCPeer } from '../../components/WebRTCProvider'
import {
  ChunkMessage,
  decodeMessage,
  Message,
  MessageType,
} from '../../messages'
import {
  browserName,
  browserVersion,
  osName,
  osVersion,
  mobileVendor,
  mobileModel,
} from 'react-device-detect'
import { setRotating } from '../useRotatingSpinner'

const CONNECTION_TIMEOUT_MS = 30_000

const cleanErrorMessage = (errorMessage: string): string =>
  errorMessage.startsWith('Could not connect to peer')
    ? 'Could not connect to the uploader. Did they close their browser?'
    : errorMessage

export interface UploaderConnectionCallbacks {
  onPasswordRequired: (errorMessage?: string) => void
  onInfo: (
    files: Array<{
      fileName: string
      size: number
      type: string
      sha256?: string
    }>,
  ) => void
  onHashUpdate: (fileName: string, sha256: string) => void
  onChunk: (message: z.infer<typeof ChunkMessage>) => void
  onError: (message: string) => void
  onClose: () => void
}

export function useUploaderConnection(uploaderPeerID: string) {
  const { peer } = useWebRTCPeer()
  const dataConnectionRef = useRef<DataConnection | null>(null)
  const connectionPromiseRef = useRef<Promise<void> | null>(null)
  const connectionCleanupRef = useRef<(() => void) | null>(null)
  const callbacksRef = useRef<UploaderConnectionCallbacks | null>(null)

  const safeSend = useCallback((message: z.infer<typeof Message>) => {
    const conn = dataConnectionRef.current
    if (!conn?.open) {
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

  const connect = useCallback(
    async (callbacks: UploaderConnectionCallbacks): Promise<boolean> => {
      if (!peer) return false
      callbacksRef.current = callbacks

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

      // reconnect
      if (peer.disconnected && !peer.destroyed) {
        console.log('[Downloader] peer signalling disconnected — reconnecting')
        peer.reconnect()
        await new Promise<void>((resolve, reject) => {
          const onOpen = () => {
            peer.off('error', onErr)
            resolve()
          }
          const onErr = (err: Error) => {
            peer.off('open', onOpen)
            reject(err)
          }
          peer.once('open', onOpen)
          peer.once('error', onErr)
          setTimeout(() => {
            peer.off('open', onOpen)
            peer.off('error', onErr)
            reject(new Error('Signalling reconnect timed out'))
          }, 10_000)
        })
      }

      if (peer.destroyed) {
        console.error('[Downloader] peer is destroyed, cannot connect')
        return false
      }

      console.log('[Downloader] connecting to uploader', uploaderPeerID)
      const conn = peer.connect(uploaderPeerID, { reliable: true })

      if (!conn) {
        console.error('[Downloader] peer.connect() returned undefined')
        return false
      }

      dataConnectionRef.current = conn

      let resolvePromise: () => void = () => {}
      let rejectPromise: (reason?: unknown) => void = () => {}
      const connectionPromise = new Promise<void>((resolve, reject) => {
        resolvePromise = resolve
        rejectPromise = reject
      })
      connectionPromiseRef.current = connectionPromise

      const timeoutId = setTimeout(() => {
        rejectPromise(new Error('Connection timed out'))
      }, CONNECTION_TIMEOUT_MS)

      const handleOpen = () => {
        clearTimeout(timeoutId)
        console.log('[Downloader] connection opened')
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
          // console.log('[Downloader] received message', message.type)
          const cb = callbacksRef.current
          if (!cb) return

          switch (message.type) {
            case MessageType.PasswordRequired:
              cb.onPasswordRequired(message.errorMessage)
              break
            case MessageType.Info:
              cb.onInfo(message.files)
              break
            case MessageType.HashUpdate:
              cb.onHashUpdate(message.fileName, message.sha256)
              break
            case MessageType.Chunk:
              cb.onChunk(message)
              setRotating(true)
              break
            case MessageType.Error:
              console.error(
                '[Downloader] received error message:',
                message.error,
              )
              cb.onError(message.error)
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
        connectionPromiseRef.current = null
        callbacksRef.current?.onClose()
      }

      const handleError = (err: Error) => {
        clearTimeout(timeoutId)
        console.error('[Downloader] connection error:', err)
        callbacksRef.current?.onError(cleanErrorMessage(err.message))
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
    },
    [peer, uploaderPeerID],
  )

  const disconnect = useCallback(() => {
    connectionCleanupRef.current?.()
    connectionCleanupRef.current = null
    connectionPromiseRef.current = null
    dataConnectionRef.current = null
  }, [])

  const isOpen = useCallback(() => dataConnectionRef.current?.open ?? false, [])

  return { connect, disconnect, safeSend, isOpen, dataConnectionRef }
}
