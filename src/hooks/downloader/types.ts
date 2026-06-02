/**
 * Minimal abstraction over a writable chunk destination.
 * Satisfied by both the OPFS FileSystemWritableFileStream wrapper
 * and the IDB-backed sink for mobile browsers.
 */
export interface ChunkSink {
  write(params: {
    type: 'write'
    position: number
    data: Uint8Array
  }): Promise<void>
  write(params: { type: 'truncate'; size: number }): Promise<void>
  close(): Promise<void>
}

export interface FileWriter {
  writable: ChunkSink
  tail: Promise<void>
  closed: boolean
  finalized: boolean
  bytesWritten: number
  expectedSize: number
  nextExpectedOffset: number
  pendingChunks: Map<number, { chunk: Uint8Array; isFinal: boolean }>
  lastSavedOffset: number
}

export interface FileInfo {
  fileName: string
  size: number
  type: string
  sha256?: string
}
