import React from 'react'

export default function StopButton({
  isDownloading,
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>
  isDownloading?: boolean
}): React.ReactElement {
  return (
    <button
      className="px-2 py-1 text-xs
  text-orange-600 dark:text-orange-400
  bg-transparent
  hover:bg-orange-100 dark:hover:bg-orange-900/40
  border border-transparent hover:border-orange-300 dark:hover:border-orange-700
  rounded transition-all duration-200 flex items-center gap-1"
      onClick={onClick}
    >
      <svg
        className="w-4 h-4 mr-1"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="4" y="4" width="16" height="16" />
      </svg>
      {isDownloading ? 'Stop Download' : 'Stop Upload'}
    </button>
  )
}
