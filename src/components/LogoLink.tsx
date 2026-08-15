'use client'
import Link from 'next/link'
import Wordmark from './Wordmark'
import { usePathname } from 'next/navigation'

export default function LogoLink() {
  const pathname = usePathname()

  return (
    <Link
      href="/"
      onClick={() => {
        if (pathname === '/') window.location.reload()
      }}
      prefetch={false}
      className="flex items-center shrink-0 hover:opacity-75 transition-opacity duration-200"
      aria-label="CheezyPizza home"
    >
      <Wordmark className="h-7 sm:h-8 md:h-9 w-auto max-w-[140px] sm:max-w-[180px] md:max-w-none" />
    </Link>
  )
}
