import React, { JSX } from 'react'

export default function DownloadButton({
  onClick,
  label = 'Download',
}: {
  onClick?: React.MouseEventHandler
  label?: string
}): JSX.Element {
  return (
    <button id="download-button" onClick={onClick} className="btn-primary">
      {label}
    </button>
  )
}
