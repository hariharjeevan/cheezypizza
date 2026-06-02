import React, { JSX } from 'react'
import { UploaderConnection, UploaderConnectionStatus } from '../types'
import ProgressBar from './ProgressBar'

export function ConnectionListItem({
  conn,
}: {
  conn: UploaderConnection
}): JSX.Element {
  const getStatusColor = (status: UploaderConnectionStatus) => {
    switch (status) {
      case UploaderConnectionStatus.Uploading:
        return 'bg-blue-500 dark:bg-blue-600'
      case UploaderConnectionStatus.Paused:
        return 'bg-yellow-500 dark:bg-yellow-600'
      case UploaderConnectionStatus.Done:
        return 'bg-green-500 dark:bg-green-600'
      case UploaderConnectionStatus.Closed:
        return 'bg-red-500 dark:bg-red-600'
      case UploaderConnectionStatus.InvalidPassword:
        return 'bg-red-500 dark:bg-red-600'
      default:
        return 'bg-stone-500 dark:bg-stone-600'
    }
  }

  function formatSpeed(bps?: number): string {
    if (!bps || bps < 1024) return '--'

    if (bps >= 1024 * 1024 * 1024)
      return `${(bps / (1024 * 1024 * 1024)).toFixed(2)} GB/s`

    if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`

    return `${Math.round(bps / 1024)} KB/s`
  }

  function formatETA(seconds?: number): string {
    if (!seconds || !isFinite(seconds)) return '--'

    if (seconds < 60) return `${Math.round(seconds)}s`

    if (seconds < 3600) {
      const m = Math.floor(seconds / 60)
      const s = Math.round(seconds % 60)
      return `${m}m ${s}s`
    }

    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)

    return `${h}h ${m}m`
  }

  const totalProgress =
    conn.totalBytes > 0
      ? Math.min(
          (conn.bytesTransferred +
            (conn.uploadingFileSize ?? 0) * conn.currentFileProgress) /
            conn.totalBytes,
          1,
        )
      : conn.completedFiles === conn.totalFiles
        ? 1
        : (conn.completedFiles + conn.currentFileProgress) / conn.totalFiles

  return (
    <div className="w-full mt-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">
            {conn.browserName && conn.browserVersion ? (
              <>
                {conn.browserName}{' '}
                <span className="text-stone-400">v{conn.browserVersion}</span>
              </>
            ) : (
              'Downloader'
            )}
          </span>
          <span
            className={`px-1.5 py-0.5 text-white rounded-md transition-colors duration-200 font-medium text-[10px] ${getStatusColor(
              conn.status,
            )}`}
          >
            {conn.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="text-sm text-stone-500 dark:text-stone-400">
          <div>
            Completed: {conn.completedFiles} / {conn.totalFiles} files
          </div>
          {conn.uploadingFileName &&
            conn.status === UploaderConnectionStatus.Uploading && (
              <div>
                Current file: {Math.round(conn.currentFileProgress * 100)}%
              </div>
            )}
        </div>
      </div>
      <ProgressBar value={totalProgress} max={1} />

      {conn.status === UploaderConnectionStatus.Uploading && (
        <div className="mt-2 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>Speed: {formatSpeed(conn.speedBytesPerSec)}</span>

          <span>ETA: {formatETA(conn.etaSeconds)}</span>
        </div>
      )}
    </div>
  )
}
