import { JSX } from 'react'
import { Link } from 'next-view-transitions'
import Wordmark from './Wordmark'
import { ModeToggle } from './ModeToggle'
import GitHubStarButton from './GitHubStarButton'

export default function Navbar(): JSX.Element {
  return (
    <header className="sticky top-0 z-40 w-full bg-amber-50/95 dark:bg-[#1a1612]/95 backdrop-blur-sm border-b border-amber-200 dark:border-[#2e2520]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* left controls */}
        <div className="flex-1 flex items-center">
          <GitHubStarButton />
        </div>

        {/* centered logo */}
        <Link
          href="/"
          className="flex items-center shrink-0 hover:opacity-75 transition-opacity duration-200"
          aria-label="CheezyPizza home"
        >
          <Wordmark className="h-9 w-auto" />
        </Link>

        {/* right controls */}
        <div className="flex-1 flex items-center gap-2.5 justify-end">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
