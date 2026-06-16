import React, { JSX } from 'react'
import { LuGlobe, LuWifi, LuArrowLeft, LuFile } from 'react-icons/lu'
import TitleText from '../components/TitleText'
import PageWrapper from './PageWrapper'
import { UploadedFile } from '../types'
import { getFileName } from '../fs'
import { pluralize } from '../utils/pluralize'

export default function ShareModePicker({
  uploadedFiles,
  onPickInternet,
  onPickLocal,
  onCancel,
}: {
  uploadedFiles: UploadedFile[]
  onPickInternet: () => void
  onPickLocal: () => void
  onCancel: () => void
}): JSX.Element {
  return (
    <PageWrapper>
      <TitleText>
        How do you want to share{' '}
        {pluralize(uploadedFiles.length, 'this file', 'these files')}?
      </TitleText>

      {/* File list */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          border: '1px solid var(--pizza-border)',
          borderRadius: 2,
          background: 'var(--pizza-bg)',
          padding: '0 1.25rem',
        }}
      >
        <p
          style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: 14,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--pizza-text-muted)',
            padding: '10px 0 8px',
            borderBottom: '1px solid var(--pizza-border)',
            margin: 0,
          }}
        >
          {uploadedFiles.length} {uploadedFiles.length === 1 ? 'file' : 'files'}
        </p>

        <div
          style={{
            maxHeight: 220, // adjust as needed
            overflowY: 'auto',
          }}
        >
          {uploadedFiles.map((f, index) => (
            <div
              key={getFileName(f)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom:
                  index !== uploadedFiles.length - 1
                    ? '1px solid var(--pizza-border)'
                    : 'none',
              }}
            >
              <LuFile
                size={13}
                aria-hidden="true"
                style={{ flexShrink: 0, color: 'var(--pizza-text-muted)' }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 14,
                  color: 'var(--pizza-text)',
                }}
              >
                {getFileName(f)}
              </span>
            </div>
          ))}
        </div>

        <div style={{ height: 4 }} />
      </div>

      {/* Share mode cards */}
      <div
        className="flex flex-col sm:flex-row gap-3 w-full max-w-lg"
        style={{ maxWidth: 480 }}
      >
        <button
          onClick={onPickInternet}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '1.1rem 1.25rem',
            background: 'var(--pizza-bg)',
            border: '1px solid var(--pizza-border)',
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = 'var(--pizza-accent)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = 'var(--pizza-border)')
          }
        >
          <LuGlobe
            aria-hidden="true"
            style={{
              color: 'var(--pizza-accent)',
              marginBottom: '0.65rem',
              fontSize: '1.1rem',
            }}
          />
          <p
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--pizza-text)',
              marginBottom: 4,
              fontWeight: 600,
            }}
          >
            Internet share
          </p>
          <p
            style={{
              fontSize: 14,
              color: 'var(--pizza-text-muted)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Share a link with anyone, anywhere
          </p>
        </button>

        <button
          onClick={onPickLocal}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '1.1rem 1.25rem',
            background: 'var(--pizza-bg)',
            border: '1px solid var(--pizza-border)',
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = 'var(--pizza-accent)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = 'var(--pizza-border)')
          }
        >
          <LuWifi
            aria-hidden="true"
            style={{
              color: 'var(--pizza-accent)',
              marginBottom: '0.65rem',
              fontSize: '1.1rem',
            }}
          />
          <p
            style={{
              fontFamily: 'DM Mono, monospace',
              fontSize: 12,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--pizza-text)',
              marginBottom: 4,
              fontWeight: 600,
            }}
          >
            Local share
          </p>
          <p
            style={{
              fontSize: 14,
              color: 'var(--pizza-text-muted)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Share directly with a device on your local network
          </p>
        </button>
      </div>

      <button
        onClick={onCancel}
        className="btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <LuArrowLeft size={14} aria-hidden="true" />
        Choose different files
      </button>
    </PageWrapper>
  )
}
