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
    <div className="flex flex-col w-full gap-1.5">
      <InputLabel
        hasError={isInvalid}
        tooltip="The downloader must provide this password to start downloading the file. If you don't specify a password here, any downloader with the link to the file will be able to download it. It is not used to encrypt the file, as this is performed by WebRTC's DTLS already."
      >
        {isRequired ? 'Password' : 'Password (optional)'}
      </InputLabel>
      <input
        autoFocus
        type="password"
        className="w-full px-3 py-2.5 text-sm font-mono transition-colors duration-200 focus:outline-none"
        style={{
          background: 'var(--pizza-bg)',
          color: 'var(--pizza-text)',
          border: `1px solid ${isInvalid ? '#ef4444' : 'var(--pizza-border)'}`,
          borderRadius: '2px',
          boxShadow: isInvalid ? '0 0 0 2px rgba(239,68,68,0.15)' : 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = isInvalid
            ? '#ef4444'
            : 'var(--pizza-accent)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = isInvalid
            ? '#ef4444'
            : 'var(--pizza-border)'
        }}
        placeholder="Enter a secret password for this slice of CheezyPizza..."
        value={value}
        onChange={handleChange}
      />
    </div>
  )
}
