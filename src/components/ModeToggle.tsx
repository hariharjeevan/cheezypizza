'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState, JSX } from 'react'

function SunIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function ModeToggle(): JSX.Element {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="
        w-9 h-9 flex items-center justify-center rounded-lg
        text-amber-900 dark:text-amber-300
        bg-amber-100 dark:bg-amber-950/60
        border border-amber-300 dark:border-amber-800
        hover:bg-amber-200 dark:hover:bg-amber-900/60
        hover:border-amber-400 dark:hover:border-amber-700
        transition-colors duration-200
      "
      aria-label="Toggle colour mode"
    >
      {mounted && (resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />)}
    </button>
  )
}
