import { FileWriter } from './types'
import {
  getOrCreateOPFSFile,
  openOPFSChunkSink,
  openWritableStream,
} from '../../utils/opfsCache'
import { saveProgress } from '../../utils/resumeStore'

export async function closeWriter(
  writer: FileWriter,
  label: string,
): Promise<void> {
  if (writer.closed) return
  try {
    await writer.tail
  } catch (err) {
    console.warn(
      `[Downloader] writer tail rejected during close (${label}):`,
      err,
    )
  }
  if (writer.closed) return
  try {
    writer.closed = true
    await writer.writable.close()
  } catch (err) {
    console.warn(`[Downloader] error closing writer (${label}):`, err)
  }
}

export async function openWriter(
  uploaderPeerID: string,
  fileName: string,
  expectedSize: number,
  savedOffset: number,
  opfsKey: string,
  sessionId: string | null,
): Promise<{
  writer: FileWriter
  handle: FileSystemFileHandle
  resumeOffset: number
}> {
  const handle = await getOrCreateOPFSFile(opfsKey)
  let resumeOffset = savedOffset

  if (savedOffset > 0) {
    const existingFile = await handle.getFile()
    if (existingFile.size < savedOffset) {
      console.warn(
        `[Downloader] OPFS smaller than saved offset for ${fileName}: ` +
          `file=${existingFile.size} saved=${savedOffset}. Rolling back.`,
      )
      resumeOffset = existingFile.size
      await saveProgress(
        uploaderPeerID,
        fileName,
        resumeOffset,
        expectedSize,
        sessionId ?? undefined,
      )
    } else if (existingFile.size > savedOffset) {
      resumeOffset = savedOffset
    }
  }

  const sink = await openOPFSChunkSink(handle, resumeOffset)

  // Truncate stale bytes beyond recorded offset
  if (resumeOffset > 0) {
    const existingFile = await handle.getFile()
    if (existingFile.size > resumeOffset) {
      // Need raw writable for truncate during open — re-open briefly
      const rawWritable = await openWritableStream(handle, resumeOffset)
      await rawWritable.write({
        type: 'truncate',
        size: resumeOffset,
      } as FileSystemWriteChunkType)
      await rawWritable.close()
      // Re-open sink after truncation
      const freshSink = await openOPFSChunkSink(handle, resumeOffset)
      const writer: FileWriter = {
        writable: freshSink,
        tail: Promise.resolve(),
        closed: false,
        finalized: false,
        bytesWritten: resumeOffset,
        expectedSize,
        nextExpectedOffset: resumeOffset,
        lastSavedOffset: resumeOffset,
        pendingChunks: new Map(),
      }
      return { writer, handle, resumeOffset }
    }
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
  return { writer, handle, resumeOffset }
}
