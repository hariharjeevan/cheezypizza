import { DataConnection } from 'peerjs'
import { UploadedFile } from '../../types'
import { getFileName } from '../../fs'
import { Message, MessageType } from '../../messages'

export const MAX_CHUNK_SIZE = 64 * 1024 // 64 KB
const HIGH_WATERMARK = 4 * 1024 * 1024 // 4 MB — pause sending
const LOW_WATERMARK = 512 * 1024 // 512 KB — resume sending

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

/**
 * Call this on Pause and on Close to prevent phantom resumes.
 */
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

/**
 * Drive sending until the DataChannel buffer hits HIGH_WATERMARK,
 * then arm a one-shot bufferedamountlow listener to resume at LOW_WATERMARK.
 * RTT is no longer on the critical path.
 */
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

  while (!state.paused && !state.finalChunkSent) {
    if (dc.bufferedAmount >= HIGH_WATERMARK) {
      // Arm one-shot resume listener
      if (state.onBufferedAmountLow) {
        dc.removeEventListener('bufferedamountlow', state.onBufferedAmountLow)
      }
      dc.bufferedAmountLowThreshold = LOW_WATERMARK
      state.onBufferedAmountLow = () => {
        state.onBufferedAmountLow = null
        runSendWindow(conn, files, state)
      }
      dc.addEventListener('bufferedamountlow', state.onBufferedAmountLow, {
        once: true,
      })
      return
    }

    if (!conn.open) {
      console.warn('[Sender] conn closed mid-loop')
      state.paused = true
      return
    }

    const end = Math.min(file.size, state.nextOffset + MAX_CHUNK_SIZE)
    const final = isFinalChunk(end, file.size)
    const chunkOffset = state.nextOffset

    console.log(
      `[Sender] chunk ${state.currentFileName} (${chunkOffset}-${end}/${file.size}) final=${final}`,
    )

    const request: Message = {
      type: MessageType.Chunk,
      fileName: state.currentFileName!,
      offset: chunkOffset,
      bytes: file.slice(chunkOffset, end),
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
