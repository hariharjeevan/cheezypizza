'use client'

import { useCallback, useRef, useState } from 'react'

export type LocalUploadState =
  | { status: 'idle' }
  | { status: 'waiting-for-accept' }
  | { status: 'connecting' }
  | {
      status: 'transferring'
      fileName: string
      bytesSent: number
      totalBytes: number
      speedBps: number
    }
  | { status: 'done' }
  | { status: 'error'; message: string }

const CHUNK_SIZE = 64 * 1024 // 64 KB per chunk
const HIGH_WATERMARK = 4 * 1024 * 1024 // pause sending above 4 MB buffered
const LOW_WATERMARK = 512 * 1024 // resume sending below 512 KB buffered

export function useLocalUploader() {
  const [state, setState] = useState<LocalUploadState>({ status: 'idle' })
  const cancelRef = useRef(false)

  const sendFiles = useCallback(
    async (dc: RTCDataChannel, files: File[], onComplete: () => void) => {
      cancelRef.current = false

      // Set state early so UI updates
      setState({ status: 'connecting' })

      try {
        await new Promise<void>((resolve, reject) => {
          if (dc.readyState === 'open') {
            resolve()
            return
          }

          if (dc.readyState === 'closed' || dc.readyState === 'closing') {
            reject(new Error(`DataChannel already ${dc.readyState}`))
            return
          }

          // DC is in 'connecting' state, wait for it to open
          const timeout = setTimeout(() => {
            dc.removeEventListener('open', onOpenHandler)
            dc.removeEventListener('error', onErrorHandler)
            reject(new Error('DataChannel open timeout after 15s'))
          }, 15_000)

          const onOpenHandler = () => {
            clearTimeout(timeout)
            dc.removeEventListener('error', onErrorHandler)
            resolve()
          }

          const onErrorHandler = () => {
            clearTimeout(timeout)
            dc.removeEventListener('open', onOpenHandler)
            reject(new Error('DataChannel failed to open'))
          }

          dc.addEventListener('open', onOpenHandler, { once: true })
          dc.addEventListener('error', onErrorHandler, { once: true })
        })
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Connection failed',
        })
        return
      }

      // Listen for cancel signal from receiver
      dc.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data)
            if (msg.kind === 'cancel') {
              cancelRef.current = true
            }
          } catch {
            /* ignore */
          }
        }
      }

      dc.send(
        JSON.stringify({
          kind: 'manifest',
          files: files.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
          })),
        }),
      )

      const totalBytes = files.reduce((s, f) => s + f.size, 0)
      let globalBytesSent = 0

      // Speed tracking: sliding 1-second window
      let speedBps = 0
      const speedWindow: { t: number; b: number }[] = []
      function recordBytes(n: number) {
        const now = Date.now()
        speedWindow.push({ t: now, b: n })
        // Drop entries older than 1 second
        const cutoff = now - 1000
        while (speedWindow.length > 0 && speedWindow[0].t < cutoff)
          speedWindow.shift()
        speedBps = speedWindow.reduce((s, e) => s + e.b, 0)
      }

      // Event-driven backpressure using bufferedamountlow
      dc.bufferedAmountLowThreshold = LOW_WATERMARK

      function waitForDrain(): Promise<void> {
        return new Promise((resolve) => {
          if (dc.bufferedAmount <= LOW_WATERMARK || cancelRef.current) {
            resolve()
            return
          }
          const handler = () => {
            resolve()
          }
          dc.addEventListener('bufferedamountlow', handler, { once: true })
        })
      }

      try {
        for (const file of files) {
          if (cancelRef.current) break

          dc.send(
            JSON.stringify({
              kind: 'file-header',
              name: file.name,
              size: file.size,
              type: file.type,
            }),
          )

          let offset = 0

          while (offset < file.size) {
            if (cancelRef.current) break

            // Backpressure: if buffer above high watermark, wait for drain event
            if (dc.bufferedAmount > HIGH_WATERMARK) {
              await waitForDrain()
            }

            const slice = file.slice(offset, offset + CHUNK_SIZE)
            const buffer = await slice.arrayBuffer()
            dc.send(buffer)
            offset += buffer.byteLength
            globalBytesSent += buffer.byteLength
            recordBytes(buffer.byteLength)

            setState({
              status: 'transferring',
              fileName: file.name,
              bytesSent: globalBytesSent,
              totalBytes,
              speedBps,
            })
          }

          dc.send(JSON.stringify({ kind: 'file-footer', name: file.name }))
        }
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Transfer failed',
        })
        return
      }

      if (!cancelRef.current) {
        setState({ status: 'done' })
        onComplete()
      }
    },
    [],
  )

  const cancel = useCallback(() => {
    cancelRef.current = true
    setState({ status: 'idle' })
  }, [])

  return { state, setState, sendFiles, cancel }
}
