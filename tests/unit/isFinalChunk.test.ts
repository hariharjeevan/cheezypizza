import { describe, it, expect } from 'vitest'
import { isFinalChunk, MAX_CHUNK_SIZE } from '../../src/hooks/uploader/sender'

describe('isFinalChunk', () => {
  it('marks last chunk when file size is exact multiple of chunk size', () => {
    const fileSize = MAX_CHUNK_SIZE * 2
    const offset = MAX_CHUNK_SIZE
    const end = Math.min(fileSize, offset + MAX_CHUNK_SIZE)
    expect(isFinalChunk(end, fileSize)).toBe(true)
  })

  it('returns false for middle chunks', () => {
    const fileSize = MAX_CHUNK_SIZE * 3 + 123
    const offset = MAX_CHUNK_SIZE
    const end = Math.min(fileSize, offset + MAX_CHUNK_SIZE)
    expect(isFinalChunk(end, fileSize)).toBe(false)
  })
})
