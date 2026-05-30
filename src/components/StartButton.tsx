import React from 'react'

export default function StartButton({
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>
}): React.ReactElement {
  return (
    <button
      id="start-button"
      onClick={onClick}
      className="px-4 py-2
    bg-gradient-to-b from-amber-400 to-orange-500
    dark:from-amber-500 dark:to-orange-600
    text-white font-semibold
    rounded-md border border-orange-600
    shadow-sm hover:shadow-md
    hover:from-amber-300 hover:to-orange-400
    active:scale-[0.98]
    transition-all duration-200"
    >
      Start
    </button>
  )
}
