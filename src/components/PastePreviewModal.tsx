'use client'

import React, { JSX, useEffect, useMemo, useState } from 'react'
import hljs from 'highlight.js'

const PASTE_FILENAME = '___pasted___.txt'

type ContentKind = 'plain' | 'url' | 'code'

interface Detection {
  kind: ContentKind
  language?: string
  languageName?: string
}

function detectContent(text: string): Detection {
  const trimmed = text.trim()
  if (!trimmed) return { kind: 'plain' }

  if (!trimmed.includes('\n')) {
    try {
      const url = new URL(trimmed)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return { kind: 'url' }
      }
    } catch {
      // not a URL
    }
  }

  const result = hljs.highlightAuto(trimmed, [
    'javascript',
    'typescript',
    'python',
    'java',
    'c',
    'cpp',
    'csharp',
    'go',
    'rust',
    'ruby',
    'php',
    'swift',
    'kotlin',
    'bash',
    'shell',
    'sql',
    'html',
    'css',
    'json',
    'yaml',
    'xml',
  ])

  if (result.relevance >= 5 && result.language) {
    return {
      kind: 'code',
      language: result.language,
      languageName: result.language.toUpperCase(),
    }
  }

  return { kind: 'plain' }
}

function UrlContent({ text }: { text: string }): JSX.Element {
  let parsed: URL | null = null
  try {
    parsed = new URL(text.trim())
  } catch {
    /* fine */
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div className="text-5xl">🔗</div>
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
        {parsed?.hostname ?? 'URL'}
      </p>
      <a
        href={text.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-medium text-orange-500 hover:text-orange-600 underline underline-offset-4 break-all text-center max-w-sm"
      >
        {text.trim()}
      </a>
    </div>
  )
}

function CodeContent({
  text,
  language,
}: {
  text: string
  language: string
}): JSX.Element {
  const highlighted = useMemo(() => {
    try {
      return hljs.highlight(text, { language }).value
    } catch {
      return hljs.highlightAuto(text).value
    }
  }, [text, language])

  return (
    <div
      className="overflow-auto flex-1 rounded-lg border border-amber-200 dark:border-stone-700"
      style={{ background: 'var(--hljs-bg)' }}
    >
      <pre
        className="m-0 p-4 text-sm font-mono leading-relaxed min-h-full"
        style={{ background: 'var(--hljs-bg)' }}
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}

function PlainContent({ text }: { text: string }): JSX.Element {
  return (
    <div className="overflow-auto flex-1 rounded-lg border border-amber-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-4">
      <p className="text-base text-stone-800 dark:text-stone-200 whitespace-pre-wrap break-words font-mono leading-relaxed">
        {text}
      </p>
    </div>
  )
}

export function isPasteFile(fileName: string): boolean {
  return fileName === PASTE_FILENAME
}

export default function PastePreviewModal({
  readPasteBlob,
  onClose,
}: {
  readPasteBlob: () => Promise<string | null>
  onClose: () => void
}): JSX.Element {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    readPasteBlob().then((t) => {
      setText(t)
      setLoading(false)
    })
  }, [readPasteBlob])

  const detection = useMemo(
    () => (text ? detectContent(text) : { kind: 'plain' as ContentKind }),
    [text],
  )

  const handleCopy = () => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const kindLabel =
    detection.kind === 'url'
      ? '🔗 Link'
      : detection.kind === 'code'
        ? `💻 ${detection.languageName}`
        : '📋 Text snippet'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div
        className="
        relative flex flex-col
        w-full max-w-2xl h-[70vh]
        bg-amber-50 dark:bg-stone-800
        border border-amber-300 dark:border-stone-700
        rounded-2xl shadow-2xl
        p-6 gap-4
      "
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-700 dark:text-amber-100">
              {kindLabel}
            </span>
            {detection.kind === 'code' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-stone-700 text-amber-700 dark:text-amber-400 text-xs font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 inline-block" />
                {detection.languageName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!text}
              className="
                px-4 py-1.5 text-sm font-semibold rounded-lg
                text-white bg-orange-500 hover:bg-orange-600
                disabled:opacity-40 disabled:cursor-not-allowed
                active:scale-[0.98] transition-all duration-150
              "
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xl leading-none transition-colors px-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-stone-400 dark:text-stone-500">
            Loading…
          </div>
        ) : text === null ? (
          <div className="flex-1 flex items-center justify-center text-stone-400 dark:text-stone-500">
            Could not read content.
          </div>
        ) : detection.kind === 'url' ? (
          <UrlContent text={text} />
        ) : detection.kind === 'code' ? (
          <CodeContent text={text} language={detection.language!} />
        ) : (
          <PlainContent text={text} />
        )}
      </div>
    </div>
  )
}
