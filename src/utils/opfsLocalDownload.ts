/**
 * utils/opfsLocalDownload.ts
 *
 *   1. openOPFSSink()     — create a temp file in OPFS, open a writable
 *   2. sink.write(chunk)  — stream chunks directly to OPFS (no RAM accumulation)
 *   3. sink.close()       — flush + close the OPFS writable
 *   4. finalize()         — pipe OPFS file -> SW -> browser download, then delete temp file
 *
 * The SW (sw.js) must be registered and active before finalize() is called.
 * ensureSW() handles registration and waits for activation; call it early
 */

// SW registration

let swRegistrationPromise: Promise<ServiceWorkerRegistration> | null = null

/**
 * Registers /sw.js and waits until it is active.
 * Safe to call multiple times - resolves immediately on subsequent calls.
 */
export function ensureSW(): Promise<ServiceWorkerRegistration> {
  if (!swRegistrationPromise) {
    swRegistrationPromise = _registerSW()
  }
  return swRegistrationPromise
}

async function _registerSW(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    throw new Error('Service Worker not supported')
  }

  const reg =
    (await navigator.serviceWorker.getRegistration('/')) ??
    (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))

  // Already active — done
  if (reg.active) return reg

  // Wait for installing/waiting worker to activate
  return new Promise((resolve, reject) => {
    const worker = reg.installing ?? reg.waiting
    if (!worker) {
      // Should not happen, but guard anyway
      reject(new Error('No SW worker found after registration'))
      return
    }
    worker.addEventListener('statechange', function onStateChange() {
      if (worker.state === 'activated') {
        worker.removeEventListener('statechange', onStateChange)
        resolve(reg)
      } else if (worker.state === 'redundant') {
        worker.removeEventListener('statechange', onStateChange)
        reject(new Error('SW became redundant during activation'))
      }
    })
  })
}

// OPFS sink

export interface OPFSSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
  // Trigger the browser download. Deletes the OPFS temp file when done.
  finalize(fileName: string, mimeType: string): Promise<void>
}

/**
 * Opens a temporary OPFS file for writing.
 * The temp file is stored as `__dl_<random>.tmp` in the OPFS root and is
 * deleted after finalize() or abort().
 */
export async function openOPFSSink(): Promise<OPFSSink> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    throw new Error('OPFS not supported')
  }

  const root = await navigator.storage.getDirectory()
  const tmpName = `__dl_${Math.random().toString(36).slice(2)}.tmp`
  const fileHandle = await root.getFileHandle(tmpName, { create: true })
  const writable = await fileHandle.createWritable({ keepExistingData: false })

  let closed = false

  async function deleteTmp() {
    try {
      await root.removeEntry(tmpName)
    } catch {
      // cleanup
    }
  }

  return {
    async write(chunk) {
      await writable.write(chunk as unknown as FileSystemWriteChunkType)
    },

    async close() {
      if (closed) return
      closed = true
      await writable.close()
    },

    async abort() {
      if (!closed) {
        closed = true
        try {
          await writable.abort()
        } catch {
          /* ignore */
        }
      }
      await deleteTmp()
    },

    async finalize(fileName: string, mimeType: string) {
      // Ensure writable is flushed
      if (!closed) {
        closed = true
        await writable.close()
      }

      const file = await fileHandle.getFile()

      // Attempt SW streaming path first
      // Pipe the OPFS file as a ReadableStream through the SW so the browser
      // downloads it without loading it all into RAM.
      let swOk = false
      try {
        const reg = await ensureSW()
        const sw = reg.active
        if (sw) {
          await _downloadViaSSW(sw, file, fileName, mimeType)
          swOk = true
        }
      } catch (err) {
        console.warn(
          '[opfsDownload] SW pipe failed, falling back to blob URL',
          err,
        )
      }

      if (!swOk) {
        // Blob URL fallback: loads file into RAM, but only at download time
        // after transfer is complete, not during
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }

      await deleteTmp()
    },
  }
}

// SW pipe
// Sends the file's ReadableStream to the active SW via MessageChannel,
// mirroring what stream.html does, then navigates to the SW-intercepted URL
// to trigger the browser download.

async function _downloadViaSSW(
  sw: ServiceWorker,
  file: File,
  fileName: string,
  mimeType: string,
): Promise<void> {
  const safeName = fileName.replace(/^\/+/, '')
  const pathname = `${Math.random().toString(36).slice(2)}/${safeName}`
  const scope = (await navigator.serviceWorker.getRegistration('/'))!.scope
  const url = new URL(`${scope}${pathname}`).toString()

  const channel = new MessageChannel()

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('SW did not acknowledge download setup')),
      5_000,
    )

    channel.port1.onmessage = (evt) => {
      if (evt.data?.download) {
        clearTimeout(timeout)
        resolve()
      }
    }

    const readableStream = file.stream()

    sw.postMessage(
      {
        url,
        pathname,
        headers: {
          'Content-Type': mimeType || 'application/octet-stream',
          'Content-Length': String(file.size),
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        },
        readableStream,
        transferringReadable: true,
      },
      [channel.port2, readableStream as unknown as Transferable],
    )
  })

  // Navigate to the SW-intercepted URL to trigger the download
  const a = document.createElement('a')
  a.href = url
  a.download = safeName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// Returns true if OPFS write is available on this browser.
export async function isOPFSAvailable(): Promise<boolean> {
  try {
    if (!navigator.storage?.getDirectory) return false
    const root = await navigator.storage.getDirectory()
    // Try creating and immediately deleting a probe file
    const probe = `__probe_${Math.random().toString(36).slice(2)}`
    const fh = await root.getFileHandle(probe, { create: true })
    await (await fh.createWritable()).close()
    await root.removeEntry(probe)
    return true
  } catch {
    return false
  }
}
