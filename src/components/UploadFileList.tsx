import React, { JSX } from 'react'
import TypeBadge from './TypeBadge'

type UploadedFileLike = {
  fileName?: string
  type: string
  size?: number
  sha256?: string
  computedSha256?: string
  hashProgress?: number // 0-1, only present while hashing large files
}

const HASH_PLACEHOLDER = 'f'.repeat(64)

function formatFileSize(bytes?: number): string | null {
  if (bytes === undefined || !isFinite(bytes) || bytes < 0) return null
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`
}

export default function UploadFileList({
  files,
  onRemove,
}: {
  files: UploadedFileLike[]
  onRemove?: (index: number) => void
}): JSX.Element {
  const items = files.map((f: UploadedFileLike, i: number) => {
    const hashValue = f.sha256 ?? f.computedSha256
    const showHashProgress = typeof f.hashProgress === 'number' && !hashValue
    const sizeLabel = formatFileSize(f.size)

    return (
      <div
        key={f.fileName}
        className={`w-full border-b border-stone-300 dark:border-stone-700 last:border-0`}
      >
        <div className="flex justify-between items-center gap-2 py-2 pl-3 pr-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-200">
              {f.fileName}
              {sizeLabel && (
                <span className="ml-2 text-xs font-normal text-stone-400 dark:text-stone-500">
                  {sizeLabel}
                </span>
              )}
            </p>
            {showHashProgress ? (
              // Large file: hashing in progress with live progress bar
              <div className="mt-1.5 mr-2">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-teal-600 dark:text-teal-400 italic">
                    SHA-256: computing… {Math.round(f.hashProgress! * 100)}%
                  </p>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden bg-stone-200 dark:bg-stone-700">
                  <div
                    className="h-full rounded-full bg-teal-500 dark:bg-teal-400 transition-all duration-300 ease-out"
                    style={{ width: `${f.hashProgress! * 100}%` }}
                  />
                </div>
              </div>
            ) : f.sha256 === '' ? (
              <div className="relative mt-1">
                <p
                  aria-hidden="true"
                  className="invisible text-[10px] sm:text-xs break-all leading-relaxed font-mono"
                >
                  SHA-256: {HASH_PLACEHOLDER}
                </p>
                <p className="absolute inset-0 text-[10px] sm:text-xs text-stone-400 dark:text-stone-500 italic break-all leading-relaxed">
                  SHA-256: calculating...
                </p>
              </div>
            ) : hashValue ? (
              <p className="text-[10px] sm:text-xs text-stone-500 dark:text-stone-400 mt-1 break-all leading-relaxed">
                SHA-256: <span className="font-mono">{hashValue}</span>
              </p>
            ) : (
              <div className="relative mt-1">
                <p
                  aria-hidden="true"
                  className="invisible text-[10px] sm:text-xs break-all leading-relaxed font-mono"
                >
                  SHA-256: {HASH_PLACEHOLDER}
                </p>
                <p className="absolute inset-0 text-[10px] sm:text-xs text-stone-400 dark:text-stone-500 italic break-all leading-relaxed">
                  SHA-256: will be computed after transfer
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center">
            <TypeBadge type={f.type} />
            {onRemove && (
              <button
                onClick={() => onRemove?.(i)}
                className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 focus:outline-none pl-3 pr-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    )
  })

  return (
    <div className="w-full max-h-72 overflow-y-auto border border-stone-300 dark:border-stone-700 rounded-md shadow-sm dark:shadow-sm-dark bg-white dark:bg-stone-800">
      {items}
    </div>
  )
}
