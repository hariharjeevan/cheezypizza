'use client'

import React, {
  JSX,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react'
import Image from 'next/image'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-light.css'
import { extractFileList } from '../fs'
import { FaRegFile } from 'react-icons/fa'
import { ImPaste } from 'react-icons/im'
import { LuWifi } from 'react-icons/lu'

const PASTE_FILENAME = '___pasted___.txt'

type ContentKind = 'plain' | 'url' | 'code'

interface CodeDetection {
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

function detectContent(text: string): CodeDetection {
  const trimmed = text.trim()
  if (!trimmed) return { kind: 'plain' }

  if (!trimmed.includes('\n')) {
    try {
      const url = new URL(trimmed)
      if (url.protocol === 'http:' || url.protocol === 'https:')
        return { kind: 'url' }
    } catch {
      /* not a URL */
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
    'markdown',
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
      .catch(() => {
        /* silently degrade */
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return { preview, loading }
}

function UrlPreviewCard({
  url,
  preview,
  loading,
}: {
  url: string
  preview: LinkPreview | null
  loading: boolean
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3 p-3 h-full">
      {/* Clickable URL always shown at top */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs break-all"
        style={{
          color: 'var(--pizza-accent)',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          flexShrink: 0,
        }}
      >
        {url}
      </a>

      {/* Small inset preview card */}
      {loading && (
        <div
          style={{
            fontSize: '0.7rem',
            fontFamily: 'DM Mono, monospace',
            color: 'var(--pizza-text-muted)',
          }}
        >
          Loading preview…
        </div>
      )}

      {!loading && preview && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            gap: '0.6rem',
            alignItems: 'flex-start',
            border: '1px solid var(--pizza-border)',
            borderRadius: '2px',
            background: 'var(--pizza-bg-subtle)',
            padding: '0.5rem',
            maxWidth: '320px',
            overflow: 'hidden',
          }}
        >
          {preview.image && (
            <Image
              src={preview.image}
              alt=""
              width={56}
              height={56}
              style={{
                objectFit: 'cover',
                borderRadius: '2px',
                flexShrink: 0,
              }}
              unoptimized
            />
          )}
          <div className="flex flex-col gap-0.5" style={{ minWidth: 0 }}>
            <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
              {preview.logo && (
                <Image
                  src={preview.logo}
                  alt=""
                  width={12}
                  height={12}
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
                  fontSize: '0.6rem',
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
                  fontSize: '0.75rem',
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
                  fontSize: '0.68rem',
                  color: 'var(--pizza-text-muted)',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
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

function TextPreview({
  text,
  detection,
  editingRaw,
  onEdit,
  textAreaRef,
  onChange,
  disabled,
}: {
  text: string
  detection: CodeDetection
  editingRaw: boolean
  onEdit: () => void
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>
  onChange: (v: string) => void
  disabled: boolean
}): JSX.Element {
  const highlighted = useMemo(() => {
    if (detection.kind !== 'code' || !detection.language) return null
    try {
      return hljs.highlight(text, { language: detection.language }).value
    } catch {
      return hljs.highlightAuto(text).value
    }
  }, [text, detection])

  const urlForPreview =
    detection.kind === 'url' && !editingRaw ? text.trim() : null
  const { preview, loading } = useLinkPreview(urlForPreview)

  const isReadonly =
    !editingRaw && (detection.kind === 'url' || detection.kind === 'code')

  return (
    <div
      className="flex flex-col gap-2 w-full"
      style={{ flex: 1, minHeight: 0 }}
    >
      <div className="flex items-center justify-between shrink-0">
        <span
          className="font-mono text-xs tracking-widest uppercase px-2 py-0.5"
          style={{
            color: 'var(--pizza-accent)',
            border: '1px solid var(--pizza-accent)',
            borderRadius: '2px',
          }}
        >
          {detection.kind === 'url'
            ? 'URL'
            : detection.kind === 'code'
              ? detection.languageName
              : 'TEXT'}
        </span>
        {isReadonly && (
          <button
            onClick={onEdit}
            className="font-mono text-xs tracking-wider uppercase transition-colors"
            style={{
              color: 'var(--pizza-text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = 'var(--pizza-accent)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'var(--pizza-text-muted)')
            }
          >
            Edit
          </button>
        )}
      </div>

      <div
        className="overflow-auto"
        style={{
          flex: 1,
          minHeight: 0,
          background: 'var(--pizza-bg)',
          border: '1px solid var(--pizza-border)',
          borderRadius: '2px',
          overflow: isReadonly ? 'auto' : 'hidden',
        }}
      >
        {isReadonly && detection.kind === 'url' ? (
          <UrlPreviewCard
            url={text.trim()}
            preview={preview}
            loading={loading}
          />
        ) : isReadonly && detection.kind === 'code' && highlighted ? (
          <pre
            className="m-0 p-3 text-xs font-mono leading-relaxed"
            style={{ background: 'var(--hljs-bg)' }}
          >
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
        ) : (
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            style={{
              resize: 'none',
              width: '100%',
              height: '100%',
              overflow: 'auto',
              background: 'transparent',
              color: 'var(--pizza-text)',
              border: 'none',
              outline: 'none',
              padding: '0.75rem',
              fontSize: '0.8rem',
              fontFamily: 'DM Mono, monospace',
              lineHeight: '1.5',
            }}
            placeholder="Type or paste text here…"
          />
        )}
      </div>
    </div>
  )
}

export default function DropZone({
  onDropAction,
  onReceiveLocallyAction,
}: {
  onDropAction: (files: File[]) => void
  onReceiveLocallyAction?: () => void
}): JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [fileCount, setFileCount] = useState(0)
  const [showTextBox, setShowTextBox] = useState(false)
  const [text, setText] = useState('')
  const [debouncedText, setDebouncedText] = useState('')
  const [clipboardPending, setClipboardPending] = useState(false)
  const [clipboardDenied, setClipboardDenied] = useState(false)
  const [editingRaw, setEditingRaw] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Use a longer delay when the text looks like a URL being typed
    // (starts with http/https but isn't a complete valid URL yet),
    // so detection doesn't fire mid-keystroke.
    const trimmed = text.trim()
    const looksLikePartialUrl =
      /^https?:\/\//i.test(trimmed) && !trimmed.includes('\n')
    let isValidUrl = false
    if (looksLikePartialUrl) {
      try {
        const u = new URL(trimmed)
        isValidUrl = u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        /* still being typed */
      }
    }
    const delay = looksLikePartialUrl && !isValidUrl ? 1500 : 800
    const timer = setTimeout(() => setDebouncedText(text), delay)
    return () => clearTimeout(timer)
  }, [text])

  const detection = useMemo(() => detectContent(debouncedText), [debouncedText])
  useEffect(() => {
    setEditingRaw(false)
  }, [detection.kind])

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setFileCount(e.dataTransfer?.items.length || 0)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    const ct = e.currentTarget === window ? window.document : e.currentTarget
    if (
      e.relatedTarget &&
      ct instanceof Node &&
      ct.contains(e.relatedTarget as Node)
    )
      return
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer) {
        const files = await extractFileList(e)
        onDropAction(files)
      }
    },
    [onDropAction],
  )

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop])

  const handlePasteClick = useCallback(async () => {
    setClipboardPending(true)
    setClipboardDenied(false)
    setShowTextBox(true)
    try {
      const clipText = await navigator.clipboard.readText()
      setText(clipText)
      setDebouncedText(clipText)
    } catch {
      setClipboardDenied(true)
    } finally {
      setClipboardPending(false)
      setTimeout(() => textAreaRef.current?.focus(), 0)
    }
  }, [])

  const handleUploadText = useCallback(() => {
    if (!text.trim()) return
    const file = new File([text], PASTE_FILENAME, { type: 'text/plain' })
    onDropAction([file])
  }, [text, onDropAction])

  const handleCancel = useCallback(() => {
    setShowTextBox(false)
    setText('')
    setDebouncedText('')
    setClipboardDenied(false)
    setClipboardPending(false)
    setEditingRaw(false)
  }, [])

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onDropAction(Array.from(e.target.files))
        }}
        multiple
      />

      <div
        className="dropzone relative w-full transition-all duration-200 overflow-hidden"
        style={{
          height: '300px',
          background: 'var(--pizza-bg-subtle)',
          border: `2px ${isDragging ? 'solid' : 'dashed'} ${isDragging ? 'var(--pizza-accent)' : 'var(--pizza-border)'}`,
          borderRadius: '4px',
        }}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
            style={{ background: 'var(--pizza-bg-subtle)' }}
          >
            <span className="text-3xl">📂</span>
            <p
              className="font-mono text-sm tracking-widest uppercase"
              style={{ color: 'var(--pizza-accent)' }}
            >
              Drop {fileCount} file{fileCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {!showTextBox ? (
          /* ── Idle state ── */
          <div className="flex flex-col items-center justify-center h-full gap-5 px-6">
            <p
              className="text-sm text-center"
              style={{ color: 'var(--pizza-text-muted)' }}
            >
              Drop files anywhere on the page, or:
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary"
                style={{
                  borderColor: 'var(--pizza-accent-warm)',
                  color: 'var(--pizza-accent-warm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--pizza-accent-warm)'
                  e.currentTarget.style.color = 'var(--pizza-bg)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--pizza-accent-warm)'
                }}
              >
                <FaRegFile aria-hidden="true" />
                Select file
              </button>
              <button
                onClick={handlePasteClick}
                className="btn-secondary"
                style={{
                  borderColor: 'var(--pizza-accent-warm)',
                  color: 'var(--pizza-accent-warm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--pizza-accent-warm)'
                  e.currentTarget.style.color = 'var(--pizza-bg)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--pizza-accent-warm)'
                }}
              >
                <ImPaste aria-hidden="true" />
                Paste text
              </button>
            </div>
            {onReceiveLocallyAction && (
              <button
                onClick={onReceiveLocallyAction}
                className="btn-secondary"
                style={{
                  borderColor: 'var(--pizza-accent-warm)',
                  color: 'var(--pizza-accent-warm)',
                  fontSize: '0.75rem',
                  fontFamily: 'DM Mono, monospace',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.15rem',
                  lineHeight: 1.2,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--pizza-accent-warm)'
                  e.currentTarget.style.color = 'var(--pizza-bg)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--pizza-accent-warm)'
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <LuWifi aria-hidden="true" className="w-4 h-4 shrink-0" />
                  Receive from local device
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    opacity: 0.7,
                    textTransform: 'none',
                    letterSpacing: '0.05em',
                  }}
                >
                  (Same network)
                </span>
              </button>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col h-full p-4 gap-3"
            style={{ minHeight: 0 }}
          >
            {clipboardPending ? (
              <div
                className="flex items-center justify-center text-sm"
                style={{
                  flex: 1,
                  minHeight: 0,
                  color: 'var(--pizza-text-muted)',
                  border: '1px solid var(--pizza-border)',
                  borderRadius: '2px',
                  background: 'var(--pizza-bg)',
                }}
              >
                Loading…
              </div>
            ) : clipboardDenied ? (
              <div
                className="flex flex-col items-center justify-center gap-2 text-sm text-center px-4"
                style={{
                  flex: 1,
                  minHeight: 0,
                  color: 'var(--pizza-text-muted)',
                  border: '1px solid var(--pizza-border)',
                  borderRadius: '2px',
                  background: 'var(--pizza-bg)',
                  position: 'relative',
                }}
              >
                Clipboard access denied — paste manually with Ctrl+V / ⌘V
                <textarea
                  ref={textAreaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    pointerEvents: 'none',
                    width: 1,
                    height: 1,
                  }}
                />
              </div>
            ) : (
              <TextPreview
                text={text}
                detection={detection}
                editingRaw={editingRaw}
                onEdit={() => setEditingRaw(true)}
                textAreaRef={textAreaRef}
                onChange={setText}
                disabled={clipboardPending}
              />
            )}

            <div
              className="flex gap-3 justify-end shrink-0"
              style={{ height: '2.5rem' }}
            >
              <button onClick={handleCancel} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleUploadText}
                disabled={!text.trim() || clipboardPending}
                className="btn-primary"
              >
                Upload text
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
