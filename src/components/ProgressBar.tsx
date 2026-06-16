import React, { JSX, useEffect, useRef, useState } from 'react'

const PROGRESS_TICK_MS = 250

export default function ProgressBar({
  value,
  max,
}: {
  value: number
  max: number
}): JSX.Element {
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })

  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    if (value >= max) {
      setDisplayValue(max)
      return
    }

    const id = setInterval(() => {
      setDisplayValue(valueRef.current)
    }, PROGRESS_TICK_MS)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max])

  const percentage = max > 0 ? (displayValue / max) * 100 : 0
  const isComplete = displayValue >= max

  return (
    <div
      id="progress-bar"
      className="w-full h-8 sm:h-10 relative overflow-hidden"
      style={{
        border: '1px solid var(--pizza-border)',
        borderRadius: '2px',
        background: 'var(--pizza-bg-subtle)',
      }}
    >
      {/* Fill */}
      <div
        id="progress-bar-fill"
        className="h-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: `${percentage}%`,
          background: isComplete ? '#16a34a' : 'var(--pizza-accent)',
          borderRadius: '1px',
        }}
      />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <span
          id="progress-percentage"
          className="font-mono text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--pizza-text)' }}
        >
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  )
}
