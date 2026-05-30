import React, { JSX } from 'react'
import useClipboard from '../hooks/useClipboard'
import InputLabel from './InputLabel'

export function CopyableInput({
  label,
  value,
}: {
  label: string
  value: string
}): JSX.Element {
  const { hasCopied, onCopy } = useClipboard(value)

  return (
    <div className="flex flex-col w-full">
      <InputLabel>{label}</InputLabel>
      <div className="flex w-full">
        <input
          id={`copyable-input-${label.toLowerCase().replace(/\s+/g, '-')}`}
          className="grow px-3 py-2 text-xs border border-r-0 rounded-l
    text-stone-900 dark:text-stone-100
    bg-amber-50 dark:bg-stone-800
    border-amber-300 dark:border-stone-600"
          value={value}
          readOnly
        />
        <button
          className="px-4 py-2 text-sm font-medium
    text-amber-800 dark:text-amber-200
    bg-amber-100 dark:bg-stone-700
    hover:bg-amber-200 dark:hover:bg-stone-600
    rounded-r border-t border-r border-b
    border-amber-300 dark:border-stone-600
    transition-colors duration-200"
          onClick={onCopy}
        >
          {hasCopied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
