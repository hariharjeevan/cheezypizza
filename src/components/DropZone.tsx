'use client'

import React, {
  JSX,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react'
import hljs from 'highlight.js'
import { extractFileList } from '../fs'
import { FaRegFile } from 'react-icons/fa'
import { ImPaste } from 'react-icons/im'

const PASTE_FILENAME = '___pasted___.txt'

type ContentKind = 'plain' | 'url' | 'code'

interface CodeDetection {
  kind: ContentKind
  language?: string
  languageName?: string
}

function detectContent(text: string): CodeDetection {
  const trimmed = text.trim()
  if (!trimmed) return { kind: 'plain' }

  // URL detection — single line, valid http/https URL
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

  // Code detection via highlight.js auto-detect
  // Only treat as code if relevance score is high enough
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

function UrlPreview({ url }: { url: string }): JSX.Element {
  let parsed: URL | null = null
  try {
    parsed = new URL(url)
  } catch {
    /* fine */
  }

  return (
    <div className="w-full flex-1 flex flex-col justify-center items-center gap-4 rounded-lg bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 p-6">
      <div className="text-4xl">🔗</div>
      <div className="text-center break-all">
        <p className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1">
          {parsed?.hostname ?? 'URL'}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base font-medium text-orange-500 hover:text-orange-600 underline underline-offset-2 break-all"
        >
          {url}
        </a>
      </div>
      <p className="text-xs text-stone-400 dark:text-stone-500">
        Will be sent as a text snippet — receiver can open the link directly.
      </p>
    </div>
  )
}

function CodePreview({
  code,
  language,
  onEdit,
}: {
  code: string
  language: string
  languageName: string
  onEdit: () => void
}): JSX.Element {
  const highlighted = useMemo(() => {
    try {
      return hljs.highlight(code, { language }).value
    } catch {
      return hljs.highlightAuto(code).value
    }
  }, [code, language])

  return (
    <div className="w-full flex-1 flex flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between">
        <button
          onClick={onEdit}
          className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
        >
          Edit
        </button>
      </div>
      <div
        className="flex-1 min-h-0 overflow-auto rounded-lg border border-amber-300 dark:border-amber-700"
        style={{ background: 'var(--hljs-bg)' }}
      >
        <pre
          className="min-h-full m-0 p-4 text-sm font-mono leading-relaxed"
          style={{ background: 'var(--hljs-bg)' }}
        >
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  )
}

export default function DropZone({
  onDrop,
}: {
  onDrop: (files: File[]) => void
}): JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [fileCount, setFileCount] = useState(0)
  const [showTextBox, setShowTextBox] = useState(false)
  const [text, setText] = useState('')
  // Debounced text: detection only runs 800ms after typing stops,
  // preventing URL mode from triggering while the user is mid-type.
  const [debouncedText, setDebouncedText] = useState('')
  const [clipboardPending, setClipboardPending] = useState(false)
  const [clipboardDenied, setClipboardDenied] = useState(false)
  const [editingRaw, setEditingRaw] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(text), 800)
    return () => clearTimeout(timer)
  }, [text])

  const detection = useMemo(() => detectContent(debouncedText), [debouncedText])

  // Reset editingRaw when content kind changes
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
    const currentTarget =
      e.currentTarget === window ? window.document : e.currentTarget
    if (
      e.relatedTarget &&
      currentTarget instanceof Node &&
      currentTarget.contains(e.relatedTarget as Node)
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
        onDrop(files)
      }
    },
    [onDrop],
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
      setDebouncedText(clipText) // clipboard paste: apply immediately, no debounce needed
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
    onDrop([file])
  }, [text, onDrop])

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        onDrop(Array.from(e.target.files))
      }
    },
    [onDrop],
  )

  const handleCancel = useCallback(() => {
    setShowTextBox(false)
    setText('')
    setDebouncedText('')
    setClipboardDenied(false)
    setClipboardPending(false)
    setEditingRaw(false)
  }, [])

  const hintText = clipboardPending
    ? 'Requesting clipboard access…'
    : clipboardDenied
      ? 'Clipboard access denied — paste manually with Ctrl+V / ⌘V'
      : detection.kind === 'url'
        ? 'Detected a URL — receiver can open it directly.'
        : 'Text — will be sent as a snippet.'

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileInputChange}
        multiple
      />

      {/* Drop zone — wooden cooktop style */}
      <div
        className="
          relative
          w-full max-w-lg h-[400px] sm:h-[480px]
          rounded-lg
          p-6 sm:p-10
          flex flex-col items-center justify-center gap-6
          transition-colors duration-200
          overflow-hidden
        "
        style={{
          // Wood grain: repeating fine horizontal lines
          background: `
            repeating-linear-gradient(
              180deg,
              transparent 0px,
              transparent 3px,
              rgba(0,0,0,0.06) 3px,
              rgba(0,0,0,0.06) 4px
            ),
            repeating-linear-gradient(
              175deg,
              transparent 0px,
              transparent 18px,
              rgba(255,255,255,0.03) 18px,
              rgba(255,255,255,0.03) 20px
            ),
            linear-gradient(160deg, #6b3a1f 0%, #8b4e28 30%, #5c3317 60%, #7a4522 100%)
          `,
          border: '3px solid #3b1f0e',
          borderRadius: '10px',
          boxShadow:
            '0 2px 0 0 rgba(255,200,120,0.15) inset, 0 -3px 8px 0 rgba(0,0,0,0.5) inset, 0 6px 24px rgba(0,0,0,0.4)',
          // Cooktop ring: dashed inner border via outline
          outline: '2px dashed rgba(200,120,50,0.5)',
          outlineOffset: '-12px',
        }}
      >
        {/* Drag overlay — scoped to zone only */}
        <div
          className={`absolute inset-0 rounded-lg bg-black bg-opacity-40 flex justify-center items-center text-xl font-semibold text-amber-200 transition-opacity duration-200 z-10 ${
            isDragging ? 'opacity-85 visible' : 'opacity-0 invisible'
          }`}
        >
          Drop {fileCount} file{fileCount !== 1 ? 's' : ''}
        </div>

        {!showTextBox ? (
          <>
            <p className="text-base text-amber-200 text-center">
              Drop files anywhere, or choose an option below
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleFileClick}
                className="btn-secondary px-8 py-5 text-xl font-semibold"
                style={{ color: '#fde68a', borderColor: '#fde68a' }}
              >
                <div className="flex flex-row items-center gap-3">
                  <FaRegFile className="text-xl" />
                  Select File
                </div>
              </button>

              <button
                onClick={handlePasteClick}
                className="btn-secondary px-8 py-5 text-xl font-semibold"
                style={{ color: '#fde68a', borderColor: '#fde68a' }}
              >
                <div className="flex flex-row items-center gap-3">
                  <ImPaste className="text-xl" /> Paste Text
                </div>
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col gap-3">
            {/* Hint row */}
            <p className="text-sm text-amber-300 shrink-0">{hintText}</p>

            {/* Content area */}
            {clipboardPending ? (
              <div className="flex-1 flex items-center justify-center text-stone-400 dark:text-stone-500 text-base">
                Loading…
              </div>
            ) : detection.kind === 'url' && !editingRaw ? (
              <UrlPreview url={text} />
            ) : detection.kind === 'code' && !editingRaw ? (
              <CodePreview
                code={text}
                language={detection.language!}
                languageName={detection.languageName!}
                onEdit={() => setEditingRaw(true)}
              />
            ) : (
              <textarea
                ref={textAreaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={clipboardPending}
                style={{ resize: 'none' }}
                className="
                  w-full flex-1 rounded-lg p-4 text-base font-mono
                  text-stone-800 dark:text-amber-50
                  bg-white dark:bg-stone-900
                  border border-amber-300 dark:border-amber-700
                  focus:outline-none focus:ring-2 focus:ring-orange-400
                  disabled:opacity-50
                  transition-colors duration-150
                "
                placeholder="Type or paste text here…"
              />
            )}

            {/* Actions */}
            <div className="flex gap-3 self-end shrink-0">
              <button onClick={handleCancel} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleUploadText}
                disabled={!text.trim() || clipboardPending}
                className="btn-primary"
              >
                Upload Text
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
