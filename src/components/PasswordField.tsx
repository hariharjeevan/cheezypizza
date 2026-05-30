import React, { JSX, useCallback } from 'react'
import InputLabel from './InputLabel'

export default function PasswordField({
  value,
  onChange,
  isRequired = false,
  isInvalid = false,
}: {
  value: string
  onChange: (v: string) => void
  isRequired?: boolean
  isInvalid?: boolean
}): JSX.Element {
  const handleChange = useCallback(
    function (e: React.ChangeEvent<HTMLInputElement>): void {
      onChange(e.target.value)
    },
    [onChange],
  )

  return (
    <div className="flex flex-col w-full">
      <InputLabel
        hasError={isInvalid}
        tooltip="The downloader must provide this password to start downloading the file. If you don't specify a password here, any downloader with the link to the file will be able to download it. It is not used to encrypt the file, as this is performed by WebRTC's DTLS already."
      >
        {isRequired ? 'Password' : 'Password (optional)'}
      </InputLabel>
      <input
        autoFocus
        type="password"
        className={`
          w-full px-3 py-2.5 rounded-lg text-sm
          bg-amber-50 dark:bg-[#1a1612]
          text-stone-900 dark:text-amber-50
          placeholder:text-stone-400 dark:placeholder:text-stone-600
          border focus:outline-none focus:ring-2
          transition-colors duration-200
          ${
            isInvalid
              ? 'border-red-400 dark:border-red-500 focus:ring-red-300 dark:focus:ring-red-800'
              : 'border-amber-300 dark:border-[#2e2520] focus:ring-amber-300 dark:focus:ring-amber-900 focus:border-amber-400 dark:focus:border-amber-800'
          }
        `}
        placeholder="Enter a secret password for this slice of CheezyPizza..."
        value={value}
        onChange={handleChange}
      />
    </div>
  )
}
