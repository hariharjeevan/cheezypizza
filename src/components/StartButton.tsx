import React from 'react'

export default function StartButton({
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>
}): React.ReactElement {
  return (
    <button id="start-button" onClick={onClick} className="btn-primary">
      Start
    </button>
  )
}
