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
  const smoothedSpeedRef = useRef<number | undefined>(undefined)
  const lastUiUpdateRef = useRef(0)

  const bytesDownloadedRef = useRef(bytesDownloaded)
  useEffect(() => {
    bytesDownloadedRef.current = bytesDownloaded
  }, [bytesDownloaded])

  useEffect(() => {
    if (!isDownloading) {
      emaSpeedRef.current = null
      smoothedSpeedRef.current = undefined
      lastUiUpdateRef.current = 0
      setSpeedBytesPerSec(undefined)
      setEtaSeconds(undefined)
      return
    }

    lastBytesRef.current = bytesDownloadedRef.current
    lastTimeRef.current = Date.now()
    lastUiUpdateRef.current = Date.now()

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
          : 0.25 * instantSpeed + 0.75 * emaSpeedRef.current

      const speed = emaSpeedRef.current
      const previousDisplay = smoothedSpeedRef.current ?? speed
      const displaySpeed =
        speed > 0
          ? previousDisplay * 0.75 + speed * 0.25
          : previousDisplay * 0.5

      smoothedSpeedRef.current = displaySpeed

      const shouldUpdateUi =
        now - lastUiUpdateRef.current >= 1500 ||
        Math.abs(displaySpeed - (speedBytesPerSec ?? 0)) > 1024

      if (shouldUpdateUi) {
        lastUiUpdateRef.current = now
        setSpeedBytesPerSec(displaySpeed)
      }

      const totalSize = filesInfo?.reduce((s, f) => s + f.size, 0) ?? 0
      const remaining = totalSize - bytesDownloadedRef.current
      setEtaSeconds(
        displaySpeed > 1024 && remaining > 0
          ? remaining / displaySpeed
          : undefined,
      )
    }, 1000)

    return () => clearInterval(id)
  }, [isDownloading, filesInfo])

  return { speedBytesPerSec, etaSeconds }
}
