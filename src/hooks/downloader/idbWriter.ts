// hooks/downloader/idbWriter.ts

import { FileWriter } from './types'
import {
  writeIDBChunk,
  getIDBChunkOffsets,
  assembleIDBBlob,
  getIDBBlob,
  deleteIDBFile,
} from '../../utils/opfsCache'
import { saveProgress } from '../../utils/resumeStore'

export async function openIDBWriter(
  uploaderPeerID: string,
  fileName: string,
  expectedSize: number,
  savedOffset: number,
  idbKey: string,
  sessionId: string | null,
): Promise<{
  writer: FileWriter
  getBlob: () => Promise<Blob>
  resumeOffset: number
}> {
  let resumeOffset = 0
  if (savedOffset > 0) {
    const offsets = await getIDBChunkOffsets(idbKey)
    if (offsets.length > 0) {
      resumeOffset = savedOffset
    } else {
      resumeOffset = 0
      await saveProgress(
        uploaderPeerID,
        fileName,
        0,
        expectedSize,
        sessionId ?? undefined,
      )
    }
  }

  // writerRef lets the sink read writer.finalized without a circular reference at
  // construction time — assigned immediately after writer is created below.
  const writerRef: { current: FileWriter | null } = { current: null }

  let sinkClosed = false
  let assembled = false

  const sink = {
    async write(
      params:
        | { type: 'write'; position: number; data: Uint8Array }
        | { type: 'truncate'; size: number },
    ): Promise<void> {
      if (params.type === 'write') {
        await writeIDBChunk(idbKey, params.position, params.data)
      }
      // truncate is a no-op on IDB path — assembly on close handles exact size
    },
    async close(): Promise<void> {
      if (sinkClosed) return
      sinkClosed = true

      // Only assemble when the download finished cleanly.
      // If writer.finalized is false, this is a flush-close from pause/stop —
      // leave chunks in IDB so the next resume can pick them up.
      const finalized = writerRef.current?.finalized ?? false
      if (!finalized) return

      await assembleIDBBlob(idbKey)
      assembled = true

      if (writerRef.current) {
        writerRef.current.closed = true
      }
    },
  }

  const writer: FileWriter = {
    writable: sink,
    tail: Promise.resolve(),
    closed: false,
    finalized: false,
    bytesWritten: resumeOffset,
    expectedSize,
    nextExpectedOffset: resumeOffset,
    lastSavedOffset: resumeOffset,
    pendingChunks: new Map(),
  }

  writerRef.current = writer

  const getBlob = async (): Promise<Blob> => {
    if (!assembled) {
      await assembleIDBBlob(idbKey)
      assembled = true
    }
    const blob = await getIDBBlob(idbKey)
    if (!blob) throw new Error(`IDB blob not found for key: ${idbKey}`)
    return blob
  }

  return { writer, getBlob, resumeOffset }
}

export { deleteIDBFile }
