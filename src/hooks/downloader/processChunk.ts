import { z } from 'zod'
import { ChunkMessage, Message, MessageType } from '../../messages'
import { FileWriter, FileInfo } from './types'
import { normalizeChunkBytes } from './cryptoDownloader'
import { saveProgress } from '../../utils/resumeStore'
import { setRotating } from '../useRotatingSpinner'
import type {
  SingleFileStreamController,
  MultiFileStreamController,
} from '../../utils/streamingDownload'

const PROGRESS_SAVE_INTERVAL = 4 * 1024 * 1024

export interface ChunkProcessorDeps {
  writers: Record<string, FileWriter>
  opfsHandles: Record<string, FileSystemFileHandle>
  fileHashesRef: React.MutableRefObject<Record<string, string>>
  filesInfo: FileInfo[]
  uploaderPeerID: string
  sessionIdRef: React.MutableRefObject<string | null>
  safeSend: (message: z.infer<typeof Message>) => void
  setBytesDownloaded: React.Dispatch<React.SetStateAction<number>>
  onFileComplete: (fileName: string) => void
  onFileTransferComplete?: (fileName: string) => void
  onFileError: (fileName: string, reason: string) => void
  onLocalHashComputed?: (fileName: string, localHash: string) => void
  onHashProgress?: (fileName: string, progress: number) => void
}

export function makeProcessChunk(deps: ChunkProcessorDeps) {
  const {
    writers,
    uploaderPeerID,
    sessionIdRef,
    safeSend,
    setBytesDownloaded,
    onFileComplete,
    onFileTransferComplete,
    onFileError,
  } = deps

  return async function processChunk(
    message: z.infer<typeof ChunkMessage>,
  ): Promise<void> {
    const writer = writers[message.fileName]
    if (!writer) {
      console.error('[Downloader] no writer for', message.fileName)
      return
    }

    const chunk = await normalizeChunkBytes(message.bytes)
    const fileName = message.fileName
    const chunkOffset = message.offset
    const isFinal = message.final

    // Duplicate chunk — ack and skip
    if (chunkOffset < writer.nextExpectedOffset) {
      console.warn('[Downloader] duplicate chunk ignored', {
        fileName,
        chunkOffset,
      })
      safeSend({
        type: MessageType.ChunkAck,
        fileName,
        offset: chunkOffset,
        bytesReceived: chunk.byteLength,
      } as z.infer<typeof Message>)
      return
    }

    // Out-of-order — buffer for later
    if (chunkOffset !== writer.nextExpectedOffset) {
      writer.pendingChunks.set(chunkOffset, { chunk, isFinal })
      return
    }

    writer.tail = writer.tail
      .then(async () => {
        if (writer.closed || writer.finalized) return

        let currentChunk = chunk
        let currentOffset = chunkOffset
        let currentIsFinal = isFinal

        while (true) {
          const chunkSize = currentChunk.byteLength

          await writer.writable.write({
            type: 'write',
            position: currentOffset,
            data: currentChunk,
          })

          writer.bytesWritten += chunkSize
          writer.nextExpectedOffset += chunkSize

          const sinceLastSave =
            writer.nextExpectedOffset - (writer.lastSavedOffset ?? 0)
          if (currentIsFinal || sinceLastSave >= PROGRESS_SAVE_INTERVAL) {
            await saveProgress(
              uploaderPeerID,
              fileName,
              writer.nextExpectedOffset,
              writer.expectedSize,
              sessionIdRef.current ?? undefined,
            )
            writer.lastSavedOffset = writer.nextExpectedOffset
          }

          setBytesDownloaded((bd) => bd + chunkSize)
          setRotating(true)

          safeSend({
            type: MessageType.ChunkAck,
            fileName,
            offset: currentOffset,
            bytesReceived: chunkSize,
          } as z.infer<typeof Message>)

          if (!currentIsFinal) {
            const next = writer.pendingChunks.get(writer.nextExpectedOffset)
            if (!next) break
            writer.pendingChunks.delete(writer.nextExpectedOffset)
            currentOffset = writer.nextExpectedOffset
            currentChunk = next.chunk
            currentIsFinal = next.isFinal
            continue
          }

          // Final chunk — verify size
          if (writer.nextExpectedOffset !== writer.expectedSize) {
            console.error(
              '[Downloader] final chunk written but size mismatch',
              {
                fileName,
                written: writer.nextExpectedOffset,
                expected: writer.expectedSize,
              },
            )
            onFileError(fileName, 'Size mismatch after final chunk')
            break
          }

          writer.finalized = true
          writer.closed = true

          // Truncate to exact size then close
          await writer.writable.write({
            type: 'truncate',
            size: writer.expectedSize,
          })
          await writer.writable.close()

          onFileTransferComplete?.(fileName)
          onFileComplete(fileName)
          break
        }
      })
      .catch((err) => {
        console.error('[Downloader] write/finalize error for', fileName, err)
        onFileError(fileName, `Download failed for ${fileName}: ${err.message}`)
      })
  }
}

// Streaming path (no storage)

export interface StreamingChunkProcessorDeps {
  filesInfo: FileInfo[]
  singleController: SingleFileStreamController | null
  multiController: MultiFileStreamController | null
  safeSend: (message: z.infer<typeof Message>) => void
  setBytesDownloaded: React.Dispatch<React.SetStateAction<number>>
  onFileTransferComplete: (fileName: string) => void
  onFileComplete: (fileName: string) => void
  onFileError: (fileName: string, reason: string) => void
  /** Tracks bytes written per file so we can verify size on final chunk */
  bytesWrittenPerFile: Record<string, number>
}

export function makeProcessChunkStreaming(deps: StreamingChunkProcessorDeps) {
  const {
    filesInfo,
    singleController,
    multiController,
    safeSend,
    setBytesDownloaded,
    onFileTransferComplete,
    onFileComplete,
    onFileError,
    bytesWrittenPerFile,
  } = deps

  return async function processChunkStreaming(
    message: z.infer<typeof ChunkMessage>,
  ): Promise<void> {
    const chunk = await normalizeChunkBytes(message.bytes)
    const fileName = message.fileName
    const chunkOffset = message.offset
    const isFinal = message.final
    const chunkSize = chunk.byteLength

    // Streaming path has no resume — offset must always be sequential.
    // If we get an out-of-order chunk something has gone wrong.
    const expectedOffset = bytesWrittenPerFile[fileName] ?? 0
    if (chunkOffset !== expectedOffset) {
      console.error('[Downloader/streaming] unexpected chunk offset', {
        fileName,
        chunkOffset,
        expectedOffset,
      })
      onFileError(fileName, `Unexpected chunk offset for ${fileName}`)
      return
    }

    try {
      if (singleController) {
        await singleController.writeChunk(chunk, isFinal)
      } else if (multiController) {
        multiController.writeChunk(chunk, isFinal)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Downloader/streaming] write error for', fileName, err)
      onFileError(fileName, `Streaming write failed for ${fileName}: ${msg}`)
      return
    }

    bytesWrittenPerFile[fileName] = expectedOffset + chunkSize
    setBytesDownloaded((bd) => bd + chunkSize)
    setRotating(true)

    safeSend({
      type: MessageType.ChunkAck,
      fileName,
      offset: chunkOffset,
      bytesReceived: chunkSize,
    } as z.infer<typeof Message>)

    if (isFinal) {
      const fileInfo = filesInfo.find((f) => f.fileName === fileName)
      const totalWritten = bytesWrittenPerFile[fileName]

      if (fileInfo && totalWritten !== fileInfo.size) {
        console.error('[Downloader/streaming] size mismatch on final chunk', {
          fileName,
          written: totalWritten,
          expected: fileInfo.size,
        })
        onFileError(fileName, `Size mismatch after final chunk for ${fileName}`)
        return
      }

      if (multiController) {
        // For multi-file zip: finalization of the zip entry was already
        // signalled inside writeChunk(isFinal=true). Just notify progress.
      }

      onFileTransferComplete(fileName)
      onFileComplete(fileName)
    }
  }
}
