import React, { JSX } from 'react'

export default function DownloadButton({
  onClick,
  label = 'Download',
}: {
  onClick?: React.MouseEventHandler
  label?: string
}): JSX.Element {
  return (
    <button
      id="download-button"
      onClick={onClick}
      className="h-12 px-5
    bg-gradient-to-b from-amber-400 to-orange-500
    dark:from-amber-500 dark:to-orange-600
    text-white font-semibold
    rounded-md border border-orange-600
    shadow-sm hover:shadow-md
    hover:from-amber-300 hover:to-orange-400
    active:scale-[0.98]
    transition-all duration-200"
    >
      {label}
    </button>
  )
}
