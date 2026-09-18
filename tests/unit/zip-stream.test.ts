import { describe, it, expect } from 'vitest'
import { unzipSync, strToU8, strFromU8 } from 'fflate'
import { createZipStream } from '../../src/zip-stream'

/**
 * These tests validate the raw bytes produced by the hand-rolled ZIP writer in
 * src/zip-stream.ts (used as the main-thread fallback when the fflate Web
 * Worker is unavailable, and on the IndexedDB/mobile path).
 *
 * Regression context: issue #8 — "Multi-file zipping returns empty or is
 * malformed on some browsers". Prior to this file there was no coverage that
 * ever parsed the produced ZIP, so a corrupt central directory / truncation
 * could ship silently.
 */

function makeFileStream(
  content: Uint8Array,
  chunkSize = 1024,
): ReadableStream<Uint8Array> {
  let offset = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= content.length) {
        controller.close()
        return
      }
      const end = Math.min(offset + chunkSize, content.length)
      controller.enqueue(content.slice(offset, end))
      offset = end
    },
  })
}

async function collect(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function buildZip(
  files: Array<{ name: string; content: Uint8Array; chunkSize?: number }>,
): Promise<Uint8Array> {
  const stream = createZipStream({
    start(ctrl) {
      for (const file of files) {
        ctrl.enqueue({
          name: file.name,
          size: file.content.length,
          stream: () => makeFileStream(file.content, file.chunkSize),
        })
      }
      ctrl.close()
    },
    pull() {},
  })
  return collect(stream)
}

/** Reads the End Of Central Directory signature (0x06054b50). */
function hasEOCD(zip: Uint8Array): boolean {
  for (let i = zip.length - 22; i >= 0; i--) {
    if (
      zip[i] === 0x50 &&
      zip[i + 1] === 0x4b &&
      zip[i + 2] === 0x05 &&
      zip[i + 3] === 0x06
    ) {
      return true
    }
    // The EOCD comment is at most 65535 bytes; bound the backwards scan.
    if (zip.length - 22 - i > 65535) break
  }
  return false
}

/** Reads the EOCD "total entries" field (offset 10 within EOCD). */
function eocdEntryCount(zip: Uint8Array): number {
  for (let i = zip.length - 22; i >= 0; i--) {
    if (
      zip[i] === 0x50 &&
      zip[i + 1] === 0x4b &&
      zip[i + 2] === 0x05 &&
      zip[i + 3] === 0x06
    ) {
      const view = new DataView(zip.buffer, zip.byteOffset + i)
      return view.getUint16(10, true)
    }
  }
  return -1
}

describe('createZipStream', () => {
  it('produces a parseable ZIP with a valid End Of Central Directory', async () => {
    const zip = await buildZip([
      { name: 'alpha.txt', content: strToU8('hello alpha') },
      { name: 'beta.txt', content: strToU8('hello beta') },
    ])

    expect(zip.length).toBeGreaterThan(0)
    expect(hasEOCD(zip)).toBe(true)
    expect(eocdEntryCount(zip)).toBe(2)
  })

  it('round-trips a single file with correct content', async () => {
    const content = strToU8('single file contents')
    const zip = await buildZip([{ name: 'solo.txt', content }])

    const entries = unzipSync(zip)
    expect(Object.keys(entries)).toEqual(['solo.txt'])
    expect(strFromU8(entries['solo.txt'])).toBe('single file contents')
  })

  it('round-trips multiple files preserving name and content', async () => {
    const files = [
      { name: 'a.txt', content: strToU8('A'.repeat(128)) },
      { name: 'b.bin', content: strToU8('B'.repeat(4096)) },
      { name: 'c.txt', content: strToU8('C'.repeat(3)) },
    ]
    const zip = await buildZip(files)
    const entries = unzipSync(zip)

    expect(Object.keys(entries).sort()).toEqual(['a.txt', 'b.bin', 'c.txt'])
    for (const file of files) {
      expect(strFromU8(entries[file.name])).toBe(strFromU8(file.content))
    }
  })

  it('handles files that span many chunks', async () => {
    // 64 KiB of deterministic bytes streamed in 1 KiB chunks.
    const content = new Uint8Array(64 * 1024)
    for (let i = 0; i < content.length; i++) content[i] = i % 251

    const zip = await buildZip([
      { name: 'chunky.bin', content, chunkSize: 1024 },
    ])

    const entries = unzipSync(zip)
    expect(entries['chunky.bin'].length).toBe(content.length)
    expect(entries['chunky.bin']).toEqual(content)
  })

  it('handles an empty file entry', async () => {
    const zip = await buildZip([
      { name: 'empty.txt', content: new Uint8Array(0) },
      { name: 'full.txt', content: strToU8('data') },
    ])

    const entries = unzipSync(zip)
    expect(entries['empty.txt'].length).toBe(0)
    expect(strFromU8(entries['full.txt'])).toBe('data')
  })
})
