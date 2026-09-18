import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { strToU8, strFromU8, unzipSync } from 'fflate'
import {
  streamDownloadMultipleFiles,
  type DownloadFileEntry,
} from '../../src/utils/download'

/**
 * Regression tests for issue #8 — "Multi-file zipping returns empty or is
 * malformed on some browsers" (Brave/Android, internet share).
 *
 * This exercises the mobile fallback chain in src/utils/download.ts:
 * no `showSaveFilePicker`, mobile UA -> StreamSaver is skipped -> the
 * object-URL path is used. We capture what is handed to the browser and check
 * the ZIP bytes, verify the OPFS spill path streams to disk without buffering,
 * and assert the object URL is kept alive long enough for the download manager
 * to consume it.
 */

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 16; Pixel 7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'

describe('streamDownloadMultipleFiles — mobile objectURL fallback', () => {
  const originalSetTimeout = globalThis.setTimeout
  let timeouts: number[]
  let createdObjects: unknown[]

  beforeEach(() => {
    timeouts = []
    createdObjects = []

    // jsdom's Blob lacks .stream()/.arrayBuffer(); use Node's Blob so the
    // code under test behaves like it does in a real browser.
    vi.stubGlobal('Blob', NodeBlob)

    Object.defineProperty(window.navigator, 'userAgent', {
      value: ANDROID_UA,
      configurable: true,
    })

    // jsdom does not implement a working object URL store; capture the input.
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn((obj: Blob) => {
        createdObjects.push(obj)
        return 'blob:mock-url'
      }),
      configurable: true,
      writable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    })

    // jsdom attempts a real navigation on a.click() and logs an error; the
    // download trigger itself is not what this test exercises.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    // Record the delay used before revoking the URL, but don't actually wait.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      cb: (...args: unknown[]) => void,
      ms?: number,
      ...args: unknown[]
    ) => {
      timeouts.push(ms ?? 0)
      return originalSetTimeout(cb, 0, ...args)
    }) as unknown as typeof setTimeout)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    // Drop any navigator.storage stub installed by the OPFS test.
    delete (window.navigator as { storage?: unknown }).storage
  })

  function makeEntries(): DownloadFileEntry[] {
    const asBlob = (bytes: Uint8Array) =>
      new NodeBlob([bytes]) as unknown as Blob
    return [
      { name: 'alpha.txt', size: 5, blob: asBlob(strToU8('alpha')) },
      { name: 'beta.bin', size: 4, blob: asBlob(strToU8('beta')) },
    ]
  }

  it('hands the browser a valid ZIP containing every file', async () => {
    await streamDownloadMultipleFiles(makeEntries(), 'CheezyPizza.zip')

    expect(createdObjects).toHaveLength(1)
    const blob = createdObjects[0] as Blob
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const entries = unzipSync(bytes)

    expect(Object.keys(entries).sort()).toEqual(['alpha.txt', 'beta.bin'])
    expect(strFromU8(entries['alpha.txt'])).toBe('alpha')
    expect(strFromU8(entries['beta.bin'])).toBe('beta')
  })

  it('spills the zip to OPFS and downloads the resulting File', async () => {
    // Fake the small slice of OPFS the spill path uses.
    const writes: Uint8Array[] = []
    let removedTemp = false
    const fakeFile = { name: 'opfs-temp' }

    const fakeHandle = {
      createWritable: async () => ({
        write: async (chunk: Uint8Array) => {
          writes.push(chunk.slice())
        },
        close: async () => {},
        abort: async () => {},
      }),
      getFile: async () => fakeFile,
    }
    const fakeRoot = {
      getFileHandle: async () => fakeHandle,
      removeEntry: async () => {
        removedTemp = true
      },
    }
    Object.defineProperty(window.navigator, 'storage', {
      value: { getDirectory: async () => fakeRoot },
      configurable: true,
    })

    await streamDownloadMultipleFiles(makeEntries(), 'CheezyPizza.zip')

    // The OPFS temp entry is dropped on a delayed timer; let it run.
    await new Promise((resolve) => originalSetTimeout(resolve, 20))

    // The download used the OPFS File, not an in-memory Blob.
    expect(createdObjects).toHaveLength(1)
    expect(createdObjects[0]).toBe(fakeFile)
    expect(removedTemp).toBe(true)

    // The zip was written chunk-by-chunk and is still valid.
    const total = writes.reduce((sum, chunk) => sum + chunk.length, 0)
    const zip = new Uint8Array(total)
    let offset = 0
    for (const chunk of writes) {
      zip.set(chunk, offset)
      offset += chunk.length
    }
    const entries = unzipSync(zip)
    expect(Object.keys(entries).sort()).toEqual(['alpha.txt', 'beta.bin'])
    expect(strFromU8(entries['alpha.txt'])).toBe('alpha')
  })

  it('keeps the object URL alive long enough for the download to start', async () => {
    await streamDownloadMultipleFiles(makeEntries(), 'CheezyPizza.zip')

    // The revoke runs on a delayed timer; let it fire.
    await new Promise((resolve) => originalSetTimeout(resolve, 20))

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    const maxRevokeDelay = Math.max(...timeouts)
    // Every other download path in the app uses 10_000 ms. 1_000 ms is not
    // enough on Android: revoking early yields a 0-byte / truncated ZIP.
    expect(maxRevokeDelay).toBeGreaterThanOrEqual(5000)
  })
})
