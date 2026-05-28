import React, { JSX } from 'react'
import TypeBadge from './TypeBadge'

type UploadedFileLike = {
  fileName?: string
  type: string
  sha256?: string
}

export default function UploadFileList({
  files,
  onRemove,
}: {
  files: UploadedFileLike[]
  onRemove?: (index: number) => void
}): JSX.Element {
  const items = files.map((f: UploadedFileLike, i: number) => (
    <div
      key={f.fileName}
      className={`w-full border-b border-stone-300 dark:border-stone-700 last:border-0`}
    >
      <div className="flex justify-between items-center py-2 pl-3 pr-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-200">
            {f.fileName}
          </p>
          {f.sha256 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 break-all">
              SHA-256: <span className="font-mono">{f.sha256}</span>
            </p>
          ) : null}
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
  ))

  return (
    <div className="w-full border border-stone-300 dark:border-stone-700 rounded-md shadow-sm dark:shadow-sm-dark bg-white dark:bg-stone-800">
      {items}
    </div>
  )
}
