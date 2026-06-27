// utils/opfsLocalDownload.ts

let swRegistrationPromise: Promise<ServiceWorkerRegistration> | null = null

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

  if (reg.active) return reg

  return new Promise((resolve, reject) => {
    const worker = reg.installing ?? reg.waiting
    if (!worker) {
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

export interface OPFSSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
  finalize(fileName: string, mimeType: string): Promise<{ blobUrl?: string }>
}

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

    async finalize(
      fileName: string,
      mimeType: string,
    ): Promise<{ blobUrl?: string }> {
      if (!closed) {
        closed = true
        await writable.close()
      }

      const file = await fileHandle.getFile()

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      // const isIOS = /iPhone|iPad|iPod/i.test(ua)
      const isMobileBrowser =
        /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua)

      if (!isMobileBrowser) {
        try {
          const reg = await ensureSW()
          const sw = reg.active
          if (sw) {
            await _downloadViaSSW(sw, file, fileName, mimeType)
            await deleteTmp()
            return {}
          }
        } catch (err) {
          console.warn(
            '[opfsDownload] SW pipe failed, falling back to blob URL',
            err,
          )
        }
      }

      const url = URL.createObjectURL(file)
      await deleteTmp()

      if (isMobileBrowser) {
        return { blobUrl: url }
      }

      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      return {}
    },
  }
}

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
