'use client'
import React, { JSX } from 'react'
import { GoHeartFill } from 'react-icons/go'
import SplitText from '../components/SplitText'

const GITHUB_URL = 'https://github.com/hariharjeevan/cheezypizza'
const ISSUES_URL = 'https://github.com/hariharjeevan/cheezypizza/issues'
const CONTACT_EMAIL = 'cheezypizzain@proton.me'

function GitHubIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      className="inline-block flex-shrink-0"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

export function Footer(): JSX.Element {
  return (
    <>
      <style>{`
        @keyframes pizza-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.15); }
        }
        .footer-pizza-emoji {
          display: inline-block;
          animation: pizza-pulse 3s ease-in-out infinite;
        }
      `}</style>

      <div className="h-[120px]" />
      <footer className="left-0 right-0 border-t border-amber-200 dark:border-stone-800 bg-amber-50/95 dark:bg-[#1a1612]/95 backdrop-blur-sm">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400 dark:via-amber-700 to-transparent" />

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
          {/* Row 1: branding + github cta */}
          <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Made with{' '}
              <span className="text-[#ff4d6d]">
                <GoHeartFill />
              </span>{' '}
              by{' '}
              <a
                href="https://github.com/hariharjeevan"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 dark:text-amber-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150"
              >
                Harihar Jeevan
              </a>
            </span>

            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="CheezyPizza on GitHub"
              className="btn-primary"
            >
              <GitHubIcon />
              CheezyPizza
            </a>
          </div>

          {/* Middle: animated tagline */}
          <div className="flex flex-col items-center py-1">
            <SplitText
              text="No cloud. No middleman."
              className="text-base sm:text-lg font-semibold tracking-tight text-stone-600 dark:text-stone-400 leading-snug"
              delay={30}
              duration={0.6}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="0px"
              textAlign="center"
            />
            <SplitText
              text="Just your files as a slice of pizza. 🍕"
              className="text-base sm:text-lg font-semibold tracking-tight text-amber-700 dark:text-amber-400 leading-snug"
              delay={30}
              duration={0.6}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              rootMargin="0px"
              textAlign="center"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-amber-200 dark:border-stone-800" />

          {/* Row 2: attribution + utility links */}
          <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-stone-400 dark:text-stone-600">
            <p className="text-center sm:text-left">
              Forked from{' '}
              <a
                href="https://github.com/kern/filepizza"
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-500 dark:text-stone-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors duration-150"
              >
                FilePizza
              </a>{' '}
              by{' '}
              <a
                href="http://kern.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-500 dark:text-stone-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors duration-150"
              >
                Alex Kern
              </a>
              {' & '}
              <a
                href="https://github.com/neerajbaid"
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-500 dark:text-stone-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors duration-150"
              >
                Neeraj Baid
              </a>
            </p>

            <div className="flex items-center gap-3">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-stone-400 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-400 transition-colors duration-150"
              >
                Contact
              </a>
              <span className="text-xs text-stone-300 dark:text-stone-700">
                ✦
              </span>
              <a
                href={ISSUES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-400 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-400 transition-colors duration-150"
              >
                Report an issue
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

export default Footer
