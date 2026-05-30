import { useEffect, useRef, useState } from 'react'

const EMA_ALPHA = 0.4 // higher = faster response to speed changes
const SAMPLE_INTERVAL = 1000 // ms between speed samples
const MIN_SAMPLES = 2 // samples needed before showing speed
const STALL_THRESHOLD = 1024 // bytes/s — below this show '--'

export interface TransferStats {
  speedBytesPerSec: number | null // null = not yet known
  etaSeconds: number | null // null = not yet known
  speedLabel: string // formatted, e.g. "4.2 MB/s"
  etaLabel: string // formatted, e.g. "1m 23s"
}

function formatSpeed(bps: number | null): string {
  if (bps === null || bps < STALL_THRESHOLD) return '--'
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} GB/s`
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} KB/s`
  return `${Math.round(bps)} B/s`
}

function formatETA(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds) || seconds < 0) return '--'
  if (seconds < 5) return 'a few seconds'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m ${s}s`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

/**
 * Computes EMA transfer speed and ETA.
 *
 * @param bytesTransferred - current total bytes transferred (ref-stable if possible)
 * @param totalBytes       - total size of all files in this transfer session
 * @param isActive         - true while actively transferring (false when paused/done)
 */
export function useTransferStats(
  bytesTransferred: number,
  totalBytes: number,
  isActive: boolean,
): TransferStats {
  const emaRef = useRef<number | null>(null)
  const samplesRef = useRef(0)
  const lastBytesRef = useRef(bytesTransferred)
  const lastTimeRef = useRef(Date.now())

  // Reset EMA when transfer stops (pause/done) so stale speed doesn't show on resume
  useEffect(() => {
    if (!isActive) {
      emaRef.current = null
      samplesRef.current = 0
      lastBytesRef.current = bytesTransferred
      lastTimeRef.current = Date.now()
    }
  }, [isActive, bytesTransferred])

  const [stats, setStats] = useState<TransferStats>({
    speedBytesPerSec: null,
    etaSeconds: null,
    speedLabel: '--',
    etaLabel: '--',
  })

  useEffect(() => {
    if (!isActive) return

    // Seed refs for this active session
    lastBytesRef.current = bytesTransferred
    lastTimeRef.current = Date.now()

    const id = setInterval(() => {
      const now = Date.now()
      const elapsed = (now - lastTimeRef.current) / 1000 // seconds
      const delta = bytesTransferred - lastBytesRef.current

      lastBytesRef.current = bytesTransferred
      lastTimeRef.current = now

      if (elapsed <= 0) return

      const instantSpeed = delta / elapsed

      // Update EMA
      if (emaRef.current === null) {
        emaRef.current = instantSpeed
      } else {
        emaRef.current =
          EMA_ALPHA * instantSpeed + (1 - EMA_ALPHA) * emaRef.current
      }
      samplesRef.current++

      const speed = samplesRef.current >= MIN_SAMPLES ? emaRef.current : null
      const remaining = totalBytes - bytesTransferred
      const eta =
        speed !== null && speed >= STALL_THRESHOLD && remaining > 0
          ? remaining / speed
          : null

      setStats({
        speedBytesPerSec: speed,
        etaSeconds: eta,
        speedLabel: formatSpeed(speed),
        etaLabel: formatETA(eta),
      })
    }, SAMPLE_INTERVAL)

    return () => clearInterval(id)
    // bytesTransferred intentionally excluded — read via ref inside interval
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, totalBytes])

  return stats
}
