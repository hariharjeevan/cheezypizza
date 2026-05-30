import React, { useRef, useCallback, JSX } from 'react'
import { UploadedFile } from '../types'

export default function AddFilesButton({
  onAdd,
}: {
  onAdd: (files: UploadedFile[]) => void
}): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        onAdd(Array.from(e.target.files) as UploadedFile[])
        e.target.value = ''
      }
    },
    [onAdd],
  )

  return (
    <>
      <input
        id="add-files-input"
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={handleChange}
      />
      <button
        id="add-files-button"
        type="button"
        onClick={handleClick}
        className="underline text-amber-700 dark:text-amber-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors duration-200"
      >
        Add more files
      </button>
    </>
  )
}
