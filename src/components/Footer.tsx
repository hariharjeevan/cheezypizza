'use client'
import React, { JSX } from 'react'
import { GoHeartFill } from 'react-icons/go'
import StatsBar from '../components/StatsBar'

const GITHUB_URL = 'https://github.com/hariharjeevan/cheezypizza'

function FooterLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <a
      className="text-amber-700 dark:text-amber-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 font-medium"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

function GitHubIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="25"
      height="25"
      fill="currentColor"
      aria-hidden="true"
      className="inline-block mb-0.5"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

export function Footer(): JSX.Element {
  return (
    <>
      <div className="h-[120px]" />
      <footer
        className="left-0 right-0
        border-t border-amber-200 dark:border-stone-800
        bg-amber-50/95 dark:bg-[#1a1612]/95 backdrop-blur-sm"
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-400 dark:via-amber-600 to-transparent" />
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col items-center gap-1.5">
          <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-stone-700 dark:text-stone-300 font-semibold">
                Made with{' '}
                <div className="text-[#ff4d6d]">
                  <GoHeartFill />
                </div>{' '}
                by{' '}
                <FooterLink href="https://github.com/hariharjeevan">
                  Harihar Jeevan
                </FooterLink>
              </span>
            </div>

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="CheezyPizza on GitHub"
              className="flex items-center gap-1 text-sm font-medium px-7 py-5 rounded-full
                border border-amber-300 dark:border-stone-600
                text-amber-800 dark:text-stone-300
                hover:bg-amber-100 dark:hover:bg-stone-800
                transition-colors duration-200"
            >
              <GitHubIcon /> CheezyPizza
            </a>

            {/* Row 3: Credits */}
            <p className="text-xs text-stone-500 dark:text-stone-500 text-center">
              Forked with gratitude from{' '}
              <FooterLink href="https://github.com/kern/filepizza">
                FilePizza
              </FooterLink>
              <br />
              <span>🍕</span>
              <br />
              <FooterLink href="http://kern.io">Alex Kern</FooterLink>
              {' & '}
              <FooterLink href="https://github.com/neerajbaid">
                Neeraj Baid
              </FooterLink>
              {/* <FooterLink href="https://github.com/kern/filepizza#faq">
                FAQ
              </FooterLink> */}
            </p>
            <StatsBar variant="footer" />
          </div>
        </div>
      </footer>
    </>
  )
}

export default Footer
