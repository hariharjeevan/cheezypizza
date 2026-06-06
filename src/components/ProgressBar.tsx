import React, { JSX, useEffect, useRef, useState } from 'react'

const PROGRESS_TICK_MS = 250

export default function ProgressBar({
  value,
  max,
}: {
  value: number
  max: number
}): JSX.Element {
  // Ref tracks latest value without triggering renders on every chunk ACK
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })

  // Display value — only updated by the interval (or immediately on complete)
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    // Flush immediately on completion so the bar hits 100% without waiting a tick
    if (value >= max) {
      setDisplayValue(max)
      return
    }

    const id = setInterval(() => {
      setDisplayValue(valueRef.current)
    }, PROGRESS_TICK_MS)

    return () => clearInterval(id)
    // Only restart interval when max changes (new file / new download)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max])

  const percentage = max > 0 ? (displayValue / max) * 100 : 0
  const isComplete = displayValue >= max

  return (
    <div
      id="progress-bar"
      className="w-full h-8 sm:h-10 rounded-[10px] overflow-hidden relative shadow-inner
        bg-amber-100 dark:bg-stone-800"
    >
      {/* Fill */}
      <div
        id="progress-bar-fill"
        className={`h-full rounded-[10px] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
          relative overflow-hidden
          ${
            isComplete
              ? 'bg-gradient-to-r from-lime-500 to-green-600'
              : 'bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600 dark:from-amber-500 dark:via-orange-500 dark:to-red-500'
          }`}
        style={{ width: `${percentage}%` }}
      >
        {!isComplete && (
          <div
            className="absolute inset-y-0 left-0 w-full animate-[shimmer_2s_ease-in-out_infinite]
            bg-gradient-to-r from-transparent via-white/25 to-transparent
            -skew-x-12"
          />
        )}
      </div>

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <span
          id="progress-percentage"
          className="font-serif font-bold text-sm tracking-wide
      text-stone-900 dark:text-white
      [text-shadow:0_0_4px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.5)]"
        >
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  )
}
