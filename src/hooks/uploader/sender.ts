import { DataConnection } from 'peerjs'
import { UploadedFile } from '../../types'
import { getFileName } from '../../fs'
import { Message, MessageType } from '../../messages'

export const MAX_CHUNK_SIZE = 1024 * 1024 // 1 MB chunks
const MIN_CHUNK_SIZE = 512 * 1024 // 512 KB minimum chunk size
const HIGH_WATERMARK = 32 * 1024 * 1024 // pause when buffered amount is high
const LOW_WATERMARK = 8 * 1024 * 1024 // resume only after the buffer drains substantially
const ACK_WINDOW_BYTES = 16 * 1024 * 1024

export function isFinalChunk(end: number, fileSize: number): boolean {
  return end === fileSize
}

export function validateOffset(
  files: UploadedFile[],
  fileName: string,
  offset: number,
): UploadedFile {
  const validFile = files.find(
    (f) => getFileName(f) === fileName && offset <= f.size,
  )
  if (!validFile) throw new Error('invalid file offset')
  return validFile
}

export function safeSendOnConn(
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

function getRawDC(conn: DataConnection): RTCDataChannel | null {
  return (conn as unknown as { dataChannel: RTCDataChannel | null }).dataChannel
}

export interface SenderState {
  currentFileName: string | null
  nextOffset: number
  finalChunkSent: boolean
  paused: boolean
  onBufferedAmountLow: (() => void) | null
  dcWaitInProgress?: boolean
}

export function createSenderState(): SenderState {
  return {
    currentFileName: null,
    nextOffset: 0,
    finalChunkSent: false,
    paused: false,
    onBufferedAmountLow: null,
    dcWaitInProgress: false,
  }
}

export function clearBufferedAmountLowListener(
  conn: DataConnection,
  state: SenderState,
): void {
  const dc = getRawDC(conn)
  if (dc && state.onBufferedAmountLow) {
    dc.removeEventListener('bufferedamountlow', state.onBufferedAmountLow)
    state.onBufferedAmountLow = null
  }
}

async function readChunkWithRetry(
  blob: Blob,
  retries = 3,
  delayMs = 500,
): Promise<ArrayBuffer> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await blob.arrayBuffer()
    } catch (err) {
      const isReadable =
        err instanceof DOMException && err.name === 'NotReadableError'
      if (!isReadable || attempt === retries) throw err
      console.warn(
        `[Sender] NotReadableError on chunk read, retry ${attempt + 1}/${retries}`,
      )
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    }
  }
  // should never reach here
  throw new Error('readChunkWithRetry exhausted')
}

export function runSendWindow(
  conn: DataConnection,
  files: UploadedFile[],
  state: SenderState,
  ackedBytesRef?: { current: number },
): void {
  if (state.paused || state.finalChunkSent) return
  const dc = getRawDC(conn)
  if (!dc) {
    console.warn('[Sender] sendWindow: No data channel found')
    state.paused = true
    return
  }

  if (dc.readyState === 'open') {
    const file = files.find((f) => getFileName(f) === state.currentFileName)
    if (!file) return
    void sendLoop(conn, dc, file, files, state, ackedBytesRef)
  } else if (dc.readyState === 'connecting' && !state.dcWaitInProgress) {
    // DC is connecting, wait for it to open
    console.log('[Sender] DataChannel connecting, waiting for open...')
    state.dcWaitInProgress = true
    void waitForDataChannelOpen(conn, files, state, ackedBytesRef)
  } else if (dc.readyState === 'connecting') {
    // Already waiting, don't double-up
    console.log('[Sender] Already waiting for DataChannel to open')
  } else {
    // DC is closed or closing
    console.warn(`[Sender] sendWindow: DC in ${dc.readyState} state`)
    state.paused = true
  }
}

function getDynamicSendBudget(dc: RTCDataChannel): {
  chunkSize: number
  inFlightBytes: number
} {
  const buffered = dc.bufferedAmount ?? 0

  if (buffered >= HIGH_WATERMARK * 0.8) {
    return { chunkSize: MIN_CHUNK_SIZE, inFlightBytes: 512 * 1024 }
  }
  if (buffered >= HIGH_WATERMARK * 0.45) {
    return { chunkSize: 512 * 1024, inFlightBytes: 2 * 1024 * 1024 }
  }
  if (buffered <= LOW_WATERMARK) {
    return { chunkSize: MAX_CHUNK_SIZE, inFlightBytes: ACK_WINDOW_BYTES }
  }

  return { chunkSize: 1024 * 1024, inFlightBytes: 4 * 1024 * 1024 }
}

async function waitForAckWindow(
  conn: DataConnection,
  state: SenderState,
  ackedBytesRef: { current: number } | undefined,
  maxInFlightBytes: number,
): Promise<void> {
  const dc = getRawDC(conn)
  if (!dc || !conn.open || state.paused || state.finalChunkSent) return

  while (!state.paused && !state.finalChunkSent && conn.open) {
    const acknowledged = ackedBytesRef?.current ?? state.nextOffset
    const inFlight = Math.max(0, state.nextOffset - acknowledged)
    if (inFlight < maxInFlightBytes) return

    const buffered = dc.bufferedAmount ?? 0
    if (buffered >= HIGH_WATERMARK) {
      await new Promise<void>((resolve) => {
        const onLow = () => {
          dc.removeEventListener('bufferedamountlow', onLow)
          resolve()
        }
        dc.bufferedAmountLowThreshold = LOW_WATERMARK
        dc.addEventListener('bufferedamountlow', onLow, { once: true })
      })
      continue
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 50))
  }
}

async function waitForDataChannelOpen(
  conn: DataConnection,
  files: UploadedFile[],
  state: SenderState,
  ackedBytesRef?: { current: number },
): Promise<void> {
  const dc = getRawDC(conn)
  if (!dc) {
    state.dcWaitInProgress = false
    return
  }

  // Already open
  if (dc.readyState === 'open') {
    state.dcWaitInProgress = false
    runSendWindow(conn, files, state, ackedBytesRef)
    return
  }

  // Already closed/failed
  if (dc.readyState !== 'connecting') {
    console.warn('[Sender] DC failed to open, state:', dc.readyState)
    state.paused = true
    state.dcWaitInProgress = false
    return
  }

  // Wait for open event with timeout
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      dc.removeEventListener('open', onOpen)
      dc.removeEventListener('error', onError)
      console.warn('[Sender] DataChannel open timeout (15s)')
      state.paused = true
      state.dcWaitInProgress = false
      resolve()
    }, 15_000)

    const onOpen = () => {
      clearTimeout(timeout)
      dc.removeEventListener('open', onOpen)
      dc.removeEventListener('error', onError)
      console.log('[Sender] DataChannel opened, resuming send')
      state.dcWaitInProgress = false
      runSendWindow(conn, files, state, ackedBytesRef)
      resolve()
    }

    const onError = () => {
      clearTimeout(timeout)
      dc.removeEventListener('open', onOpen)
      dc.removeEventListener('error', onError)
      console.warn('[Sender] DataChannel error while waiting for open')
      state.paused = true
      state.dcWaitInProgress = false
      resolve()
    }

    dc.addEventListener('open', onOpen, { once: true })
    dc.addEventListener('error', onError, { once: true })
  })
}

async function sendLoop(
  conn: DataConnection,
  dc: RTCDataChannel,
  file: UploadedFile,
  files: UploadedFile[],
  state: SenderState,
  ackedBytesRef?: { current: number },
): Promise<void> {
  while (!state.paused && !state.finalChunkSent) {
    const bufferedAmount = dc.bufferedAmount ?? 0
    if (bufferedAmount >= HIGH_WATERMARK) {
      if (state.onBufferedAmountLow) {
        dc.removeEventListener('bufferedamountlow', state.onBufferedAmountLow)
      }
      dc.bufferedAmountLowThreshold = LOW_WATERMARK
      await new Promise<void>((resolve) => {
        state.onBufferedAmountLow = () => {
          state.onBufferedAmountLow = null
          resolve()
        }
        dc.addEventListener('bufferedamountlow', state.onBufferedAmountLow, {
          once: true,
        })
      })
      if (state.paused || state.finalChunkSent) return
      if (dc.readyState !== 'open' || !conn.open) {
        state.paused = true
        return
      }
      continue
    }

    if (!conn.open) {
      console.warn('[Sender] conn closed mid-loop')
      state.paused = true
      return
    }

    if (state.nextOffset >= file.size) {
      state.finalChunkSent = true
      return
    }

    const { chunkSize, inFlightBytes } = getDynamicSendBudget(dc)
    const acknowledged = ackedBytesRef?.current ?? state.nextOffset
    const inFlight = Math.max(0, state.nextOffset - acknowledged)
    if (inFlight >= inFlightBytes) {
      await waitForAckWindow(conn, state, ackedBytesRef, inFlightBytes)
      if (state.paused || state.finalChunkSent) return
    }

    const dynamicChunkSize = Math.min(
      file.size - state.nextOffset,
      Math.max(MIN_CHUNK_SIZE, chunkSize),
    )
    const end = Math.min(file.size, state.nextOffset + dynamicChunkSize)
    const final = isFinalChunk(end, file.size)
    const chunkOffset = state.nextOffset

    let buffer: ArrayBuffer
    try {
      buffer = await readChunkWithRetry(file.slice(chunkOffset, end))
    } catch (err) {
      console.error('[Sender] failed to read chunk after retries:', err)
      state.paused = true
      return
    }

    if (state.paused) return

    const request: Message = {
      type: MessageType.Chunk,
      fileName: state.currentFileName!,
      offset: chunkOffset,
      bytes: buffer,
      final,
    }

    try {
      conn.send(request)
    } catch (err) {
      console.warn('[Sender] send threw, pausing:', err)
      state.paused = true
      return
    }

    state.nextOffset = end
    if (final) state.finalChunkSent = true
  }
}
