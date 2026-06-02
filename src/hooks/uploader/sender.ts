import { DataConnection } from 'peerjs'
import { UploadedFile } from '../../types'
import { getFileName } from '../../fs'
import { Message, MessageType } from '../../messages'

export const MAX_CHUNK_SIZE = 64 * 1024 // 64 KB chunks
const HIGH_WATERMARK = 4 * 1024 * 1024 // pause when buffered amount is high
const LOW_WATERMARK = 512 * 1024 // resume when buffered amount falls below this

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
}

export function createSenderState(): SenderState {
  return {
    currentFileName: null,
    nextOffset: 0,
    finalChunkSent: false,
    paused: false,
    onBufferedAmountLow: null,
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
): void {
  if (state.paused || state.finalChunkSent) return
  const dc = getRawDC(conn)
  if (!dc || dc.readyState !== 'open') {
    console.warn('[Sender] sendWindow: DC not open')
    state.paused = true
    return
  }
  const file = files.find((f) => getFileName(f) === state.currentFileName)
  if (!file) return

  void sendLoop(conn, dc, file, files, state)
}

async function sendLoop(
  conn: DataConnection,
  dc: RTCDataChannel,
  file: UploadedFile,
  files: UploadedFile[],
  state: SenderState,
): Promise<void> {
  while (!state.paused && !state.finalChunkSent) {
    if (dc.bufferedAmount >= HIGH_WATERMARK) {
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

    const end = Math.min(file.size, state.nextOffset + MAX_CHUNK_SIZE)
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
