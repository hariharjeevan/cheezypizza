import React, { JSX } from 'react'
import TypeBadge from './TypeBadge'

type UploadedFileLike = {
  fileName?: string
  type: string
  sha256?: string
  computedSha256?: string
  hashProgress?: number // 0-1, only present while hashing large files
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

    return (
      <div
        key={f.fileName}
        className={`w-full border-b border-stone-300 dark:border-stone-700 last:border-0`}
      >
        <div className="flex justify-between items-center py-2 pl-3 pr-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-200">
              {f.fileName}
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
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 italic">
                SHA-256: calculating...
              </p>
            ) : hashValue ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 break-all">
                SHA-256: <span className="font-mono">{hashValue}</span>
              </p>
            ) : (
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 italic">
                SHA-256: will be computed after transfer
              </p>
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
    <div className="w-full border border-stone-300 dark:border-stone-700 rounded-md shadow-sm dark:shadow-sm-dark bg-white dark:bg-stone-800">
      {items}
    </div>
  )
}
