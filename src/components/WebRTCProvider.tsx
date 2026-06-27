'use client'

import React, {
  JSX,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from 'react'
import Loading from './Loading'
import Peer from 'peerjs'
import { ErrorMessage } from './ErrorMessage'

export type WebRTCPeerValue = {
  peer: Peer
  stop: () => void
}

const WebRTCContext = React.createContext<WebRTCPeerValue | null>(null)

export const useWebRTCPeer = (): WebRTCPeerValue => {
  const value = useContext(WebRTCContext)
  if (value === null) {
    throw new Error('useWebRTC must be used within a WebRTCProvider')
  }
  return value
}

let globalPeer: Peer | null = null

function createPeer(
  host: string,
  path: string,
  iceServers: object[],
  port?: number,
): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer({
      debug: 0,
      host,
      path,
      ...(port ? { port, secure: false } : {}),
      config: { iceServers },
    })
    peer.on('open', () => resolve(peer))
    peer.on('error', (err) => {
      peer.destroy()
      reject(err)
    })
  })
}

async function getOrCreateGlobalPeer(onFallback?: () => void): Promise<Peer> {
  if (globalPeer?.id) return globalPeer

  const response = await fetch('/api/ice', { method: 'POST' })
  const { host, path, fallbackHost, fallbackPath, fallbackPort, iceServers } =
    await response.json()

  try {
    globalPeer = await Promise.race([
      createPeer(host, path, iceServers),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('primary timeout')), 8000),
      ),
    ])
    console.log('[WebRTCProvider] connected to primary:', host)
  } catch (err) {
    if (!fallbackHost) throw err
    console.warn('[WebRTCProvider] primary failed, trying fallback:', err)
    onFallback?.()
    globalPeer = await createPeer(
      fallbackHost,
      fallbackPath,
      iceServers,
      fallbackPort || undefined,
    )
    console.log('[WebRTCProvider] connected to fallback:', fallbackHost)
  }

  return globalPeer!
}

export default function WebRTCPeerProvider({
  children,
}: {
  children?: React.ReactNode
}): JSX.Element {
  const [peerValue, setPeerValue] = useState<Peer | null>(globalPeer)
  const [isStopped, setIsStopped] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [loadingText, setLoadingText] = useState('Initializing WebRTC peer...')

  const stop = useCallback(() => {
    console.log('[WebRTCProvider] Stopping peer')
    globalPeer?.destroy()
    globalPeer = null
    setPeerValue(null)
    setIsStopped(true)
  }, [])

  useEffect(() => {
    getOrCreateGlobalPeer(() => {
      setLoadingText('Starting backup server, please wait...')
    })
      .then(setPeerValue)
      .catch(setError)
  }, [])

  const value = useMemo(() => ({ peer: peerValue!, stop }), [peerValue, stop])

  if (error) {
    return <ErrorMessage message={error.message} />
  }

  if (isStopped) {
    return <></>
  }

  if (!peerValue) {
    return <Loading text={loadingText} />
  }

  return (
    <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>
  )
}
