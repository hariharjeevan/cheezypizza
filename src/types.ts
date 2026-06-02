import type { DataConnection } from 'peerjs'

export type UploadedFile = File & { entryFullPath?: string }

export enum UploaderConnectionStatus {
  Pending = 'PENDING',
  Ready = 'READY',
  Paused = 'PAUSED',
  Uploading = 'UPLOADING',
  Done = 'DONE',
  Authenticating = 'AUTHENTICATING',
  InvalidPassword = 'INVALID_PASSWORD',
  Closed = 'CLOSED',
}

export type UploaderConnection = {
  status: UploaderConnectionStatus
  dataConnection: DataConnection
  browserName?: string
  browserVersion?: string
  osName?: string
  osVersion?: string
  mobileVendor?: string
  mobileModel?: string
  uploadingFileName?: string
  uploadingFileSize?: number
  uploadingOffset?: number
  acknowledgedBytes?: number
  bytesTransferred: number
  totalBytes: number
  completedFiles: number
  totalFiles: number
  currentFileProgress: number
  speedBytesPerSec?: number
  etaSeconds?: number
}
