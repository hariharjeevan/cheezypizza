import { JSX } from 'react'
import Image from 'next/image'

export default function Wordmark({
  className = '',
}: {
  className?: string
}): JSX.Element {
  return (
    <Image
      src="/images/logo.svg"
      alt="CheezyPizza"
      width={325}
      height={325}
      className={className}
      priority
    />
  )
}
