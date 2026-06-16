import React, { JSX } from 'react'
import Spinner from '../components/Spinner'

export default function PageWrapper({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <div
      style={{ minHeight: '600px' }}
      className="flex flex-col items-center justify-start"
    >
      <div className="flex flex-col items-center space-y-5 py-10 max-w-4xl w-full mx-auto px-4">
        <Spinner direction="up" />
        {children}
      </div>
    </div>
  )
}
