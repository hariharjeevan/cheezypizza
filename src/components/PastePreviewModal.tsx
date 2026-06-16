'use client'

import React, { JSX, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-light.css'

const PASTE_FILENAME = '___pasted___.txt'

type ContentKind = 'plain' | 'url' | 'code'

interface Detection {
  kind: ContentKind
  language?: string
  languageName?: string
}

interface LinkPreview {
  title?: string
  description?: string
  image?: string
  logo?: string
  publisher?: string
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

function useLinkPreview(url: string | null): {
  preview: LinkPreview | null
  loading: boolean
} {
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!url) {
      setPreview(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setPreview(null)
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.status === 'success') {
          setPreview({
            title: data.data?.title ?? undefined,
            description: data.data?.description ?? undefined,
            image: data.data?.image?.url ?? undefined,
            logo: data.data?.logo?.url ?? undefined,
            publisher: data.data?.publisher ?? undefined,
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return { preview, loading }
}

function UrlContent({ text }: { text: string }): JSX.Element {
  const url = text.trim()
  const { preview, loading } = useLinkPreview(url)

  return (
    <div
      className="overflow-auto flex-1 flex flex-col gap-4 p-4"
      style={{
        border: '1px solid var(--pizza-border)',
        borderRadius: '2px',
        background: 'var(--pizza-bg)',
      }}
    >
      {/* Clickable URL always shown at top */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm break-all"
        style={{
          color: 'var(--pizza-accent)',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          flexShrink: 0,
        }}
      >
        {url}
      </a>

      {/* Loading state */}
      {loading && (
        <div
          style={{
            fontSize: '0.75rem',
            fontFamily: 'DM Mono, monospace',
            color: 'var(--pizza-text-muted)',
          }}
        >
          Loading preview…
        </div>
      )}

      {/* Small inset preview card */}
      {!loading && preview && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            border: '1px solid var(--pizza-border)',
            borderRadius: '2px',
            background: 'var(--pizza-bg-subtle)',
            padding: '0.65rem',
            maxWidth: '400px',
            overflow: 'hidden',
          }}
        >
          {preview.image && (
            <Image
              src={preview.image}
              alt=""
              width={72}
              height={72}
              style={{
                objectFit: 'cover',
                borderRadius: '2px',
                flexShrink: 0,
              }}
              unoptimized
            />
          )}
          <div className="flex flex-col gap-1" style={{ minWidth: 0 }}>
            <div className="flex items-center gap-1.5">
              {preview.logo && (
                <Image
                  src={preview.logo}
                  alt=""
                  width={14}
                  height={14}
                  style={{
                    objectFit: 'contain',
                    flexShrink: 0,
                  }}
                  unoptimized
                />
              )}
              <span
                className="font-mono"
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--pizza-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {preview.publisher ?? new URL(url).hostname}
              </span>
            </div>
            {preview.title && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--pizza-text)',
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {preview.title}
              </p>
            )}
            {preview.description && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: 'var(--pizza-text-muted)',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {preview.description}
              </p>
            )}
          </div>
        </a>
      )}
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
      className="overflow-auto flex-1"
      style={{
        border: '1px solid var(--pizza-border)',
        borderRadius: '2px',
        background: 'var(--hljs-bg)',
      }}
    >
      <pre
        className="m-0 p-4 text-xs font-mono leading-relaxed min-h-full"
        style={{ background: 'var(--hljs-bg)' }}
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}

function PlainContent({ text }: { text: string }): JSX.Element {
  return (
    <div
      className="overflow-auto flex-1 p-4"
      style={{
        border: '1px solid var(--pizza-border)',
        borderRadius: '2px',
        background: 'var(--pizza-bg)',
      }}
    >
      <p
        className="whitespace-pre-wrap break-words leading-relaxed"
        style={{
          color: 'var(--pizza-text)',
          fontFamily: 'DM Mono, monospace',
          fontSize: '0.8rem',
        }}
      >
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

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const kindLabel =
    detection.kind === 'url'
      ? 'URL'
      : detection.kind === 'code'
        ? (detection.languageName ?? 'CODE')
        : 'TEXT'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={handleBackdrop}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl p-6 gap-4"
        style={{
          height: '70vh',
          background: 'var(--pizza-bg-subtle)',
          border: '2px solid var(--pizza-border)',
          borderRadius: '4px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <span
            className="font-mono text-xs tracking-widest uppercase px-2 py-0.5"
            style={{
              color: 'var(--pizza-accent)',
              border: '1px solid var(--pizza-accent)',
              borderRadius: '2px',
            }}
          >
            {kindLabel}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!text}
              className="btn-primary"
              style={{ height: '2rem', padding: '0 1rem', fontSize: '0.75rem' }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ height: '2rem', padding: '0 0.5rem' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div
            className="flex-1 flex items-center justify-center text-sm"
            style={{ color: 'var(--pizza-text-muted)' }}
          >
            Loading…
          </div>
        ) : text === null ? (
          <div
            className="flex-1 flex items-center justify-center text-sm"
            style={{ color: 'var(--pizza-text-muted)' }}
          >
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
