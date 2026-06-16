import React, { JSX } from 'react'

export default function CancelButton({
  onClick,
  text = 'Cancel',
}: {
  onClick: React.MouseEventHandler
  text?: string
}): JSX.Element {
  return (
    <button onClick={onClick} className="btn-secondary">
      {text}
    </button>
  )
}
