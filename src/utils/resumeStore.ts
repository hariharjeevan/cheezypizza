// utils/resumeStore.ts

const DB_NAME = 'filepizza-resume'
const DB_VERSION = 1
const STORE = 'progress'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function makeKey(
  uploaderPeerID: string,
  fileName: string,
  sessionId?: string,
): string {
  // If a sessionId is provided, include it so resume records are scoped
  // to a particular transfer instance. Falling back to previous key
  // format when sessionId is not provided maintains backwards compat.
  if (sessionId) return `${uploaderPeerID}::${sessionId}::${fileName}`
  return `${uploaderPeerID}::${fileName}`
}

export interface ResumeRecord {
  key: string
  uploaderPeerID: string
  fileName: string
  bytesReceived: number
  totalSize: number
  timestamp: number
}

/**
 * Persists the number of bytes received so far for a given file transfer.
 */
export async function saveProgress(
  uploaderPeerID: string,
  fileName: string,
  bytesReceived: number,
  totalSize: number,
  sessionId?: string,
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({
      key: makeKey(uploaderPeerID, fileName, sessionId),
      uploaderPeerID,
      fileName,
      bytesReceived,
      totalSize,
      timestamp: Date.now(),
    } satisfies ResumeRecord)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Returns the number of bytes already received for a given file transfer,
 * or 0 if no progress has been recorded.
 */
export async function getProgress(
  uploaderPeerID: string,
  fileName: string,
  sessionId?: string,
): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx
      .objectStore(STORE)
      .get(makeKey(uploaderPeerID, fileName, sessionId))
    req.onsuccess = () =>
      resolve((req.result as ResumeRecord | undefined)?.bytesReceived ?? 0)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Removes the progress record for a completed or abandoned transfer.
 */
export async function clearProgress(
  uploaderPeerID: string,
  fileName: string,
  sessionId?: string,
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(makeKey(uploaderPeerID, fileName, sessionId))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Returns all in-progress resume records (useful for showing resumable transfers on load).
 */
export async function getAllProgress(): Promise<ResumeRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as ResumeRecord[])
    req.onerror = () => reject(req.error)
  })
}
