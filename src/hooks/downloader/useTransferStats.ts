import { useEffect, useRef, useState } from 'react'
import { FileInfo } from './types'

export function useTransferStats(
  isDownloading: boolean,
  bytesDownloaded: number,
  filesInfo: FileInfo[] | null,
): { speedBytesPerSec: number | undefined; etaSeconds: number | undefined } {
  const [speedBytesPerSec, setSpeedBytesPerSec] = useState<number | undefined>()
  const [etaSeconds, setEtaSeconds] = useState<number | undefined>()

  const lastBytesRef = useRef(0)
  const lastTimeRef = useRef(Date.now())
  const emaSpeedRef = useRef<number | null>(null)

  const bytesDownloadedRef = useRef(bytesDownloaded)
  useEffect(() => {
    bytesDownloadedRef.current = bytesDownloaded
  }, [bytesDownloaded])

  useEffect(() => {
    if (!isDownloading) {
      emaSpeedRef.current = null
      setSpeedBytesPerSec(undefined)
      setEtaSeconds(undefined)
      return
    }

    lastBytesRef.current = bytesDownloadedRef.current
    lastTimeRef.current = Date.now()

    const id = setInterval(() => {
      const now = Date.now()
      const deltaBytes = bytesDownloadedRef.current - lastBytesRef.current
      const deltaTime = (now - lastTimeRef.current) / 1000
      lastBytesRef.current = bytesDownloadedRef.current
      lastTimeRef.current = now

      if (deltaTime <= 0) return

      const instantSpeed = deltaBytes / deltaTime
      emaSpeedRef.current =
        emaSpeedRef.current === null
          ? instantSpeed
          : 0.4 * instantSpeed + 0.6 * emaSpeedRef.current

      const speed = emaSpeedRef.current
      setSpeedBytesPerSec(speed)

      const totalSize = filesInfo?.reduce((s, f) => s + f.size, 0) ?? 0
      const remaining = totalSize - bytesDownloadedRef.current
      setEtaSeconds(
        speed > 1024 && remaining > 0 ? remaining / speed : undefined,
      )
    }, 1000)

    return () => clearInterval(id)
  }, [isDownloading, filesInfo])

  return { speedBytesPerSec, etaSeconds }
}
