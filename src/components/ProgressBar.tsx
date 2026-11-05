import React, { JSX, useEffect, useRef, useState } from 'react'

export default function ProgressBar({
  value,
  max,
}: {
  value: number
  max: number
}): JSX.Element {
  const [displayValue, setDisplayValue] = useState(value)
  const valueRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    const target = Math.min(Math.max(value, 0), max || value)

    const step = () => {
      const current = valueRef.current
      const next = current + (target - current) * 0.18
      const delta = Math.abs(target - next)

      valueRef.current = next
      setDisplayValue(next)

      if (delta > 0.5) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    if (value >= max) {
      valueRef.current = max
      setDisplayValue(max)
      return
    }

    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value, max])

  const clampedValue = Math.min(Math.max(displayValue, 0), max || displayValue)
  const percentage = max > 0 ? (clampedValue / max) * 100 : 0
  const isComplete = clampedValue >= max

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
