'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

// Types

export type PeerInfo = { id: string; name: string }

type S2CMsg =
  | { type: 'welcome'; id: string; name: string }
  | { type: 'peer-list'; peers: PeerInfo[] }
  | { type: 'selected'; fromId: string; fromName: string }
  | { type: 'signal'; fromId: string; data: RTCSignalData }
  | { type: 'transfer-complete' }

type C2SMsg =
  | { type: 'register-ips'; localIps: string[] }
  | { type: 'select-peer'; targetId: string }
  | { type: 'signal'; targetId: string; data: RTCSignalData }
  | { type: 'transfer-complete'; targetId: string }

type RTCSignalData =
  | { kind: 'offer'; sdp: string }
  | { kind: 'answer'; sdp: string }
  | { kind: 'ice'; candidate: RTCIceCandidateInit }

function getWsUrl(): string {
  const configured = process.env.NEXT_PUBLIC_LOCAL_WS_URL
  if (configured) return configured
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.hostname}:4000/ws`
}

// Hook

export function useLocalDiscovery(callbacks: {
  onSelected?: (fromId: string, fromName: string) => void
  onTransferComplete?: () => void
}) {
  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const pendingSignalsRef = useRef<
    Array<{ fromId: string; data: RTCSignalData }>
  >([])

  const [myId, setMyId] = useState<string | null>(null)
  const [myName, setMyName] = useState<string | null>(null)
  const [peers, setPeers] = useState<PeerInfo[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cbRef = useRef(callbacks)
  useEffect(() => {
    cbRef.current = callbacks
  })

  const sendWs = useCallback((msg: C2SMsg) => {
    const ws = wsRef.current
    // console.log('WS SEND', ws?.readyState, JSON.stringify(msg))
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  // WebSocket lifecycle
  useEffect(() => {
    let ws: WebSocket
    let reconnectTimer: ReturnType<typeof setTimeout>
    let destroyed = false

    function connect() {
      clearTimeout(reconnectTimer)

      try {
        ws = new WebSocket(getWsUrl())
        wsRef.current = ws
      } catch {
        setError('Could not connect to local discovery server')
        return
      }

      ws.onopen = () => {
        if (destroyed) {
          ws.close()
          return
        }
        setIsConnected(true)
        setError(null)
      }

      ws.onclose = () => {
        if (destroyed) return
        setIsConnected(false)
        reconnectTimer = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        if (destroyed) return
        setError('Local discovery server unreachable. Is it running?')
        setIsConnected(false)
      }

      ws.onmessage = async (event) => {
        if (destroyed) return
        let msg: S2CMsg
        try {
          msg = JSON.parse(event.data as string) as S2CMsg
        } catch {
          return
        }

        switch (msg.type) {
          case 'welcome':
            setMyId(msg.id)
            setMyName(msg.name)
            gatherLocalIps().catch(() => {})
            break

          case 'peer-list':
            setPeers(msg.peers)
            break

          case 'selected':
            cbRef.current.onSelected?.(msg.fromId, msg.fromName)
            break

          case 'signal': {
            const pc = pcRef.current
            if (!pc) {
              pendingSignalsRef.current.push({
                fromId: msg.fromId,
                data: msg.data as RTCSignalData,
              })
              return
            }
            await handleSignal(pc, msg.fromId, msg.data as RTCSignalData)
            break
          }

          case 'transfer-complete':
            cbRef.current.onTransferComplete?.()
            break
        }
      }
    }

    connect()

    return () => {
      destroyed = true
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignal(
    pc: RTCPeerConnection,
    fromId: string,
    d: RTCSignalData,
  ) {
    try {
      if (d.kind === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp })
        await flushIceCandidates(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        console.log('Sending answer')
        sendWs({
          type: 'signal',
          targetId: fromId,
          data: { kind: 'answer', sdp: answer.sdp! },
        })
      } else if (d.kind === 'answer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: d.sdp })
        await flushIceCandidates(pc)
      } else if (d.kind === 'ice') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(d.candidate).catch(() => {})
        } else {
          pendingCandidatesRef.current.push(d.candidate)
        }
      }
    } catch (err) {
      console.error('[LocalDiscovery] Signal handling error:', err)
    }
  }

  async function flushIceCandidates(pc: RTCPeerConnection) {
    for (const c of pendingCandidatesRef.current) {
      await pc.addIceCandidate(c).catch(() => {})
    }
    pendingCandidatesRef.current = []
  }

  async function drainPendingSignals(pc: RTCPeerConnection) {
    const queued = pendingSignalsRef.current.splice(0)
    for (const { fromId, data } of queued) {
      await handleSignal(pc, fromId, data)
    }
  }

  // IP Gathering

  const gatherLocalIps = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const candidates = new Set<string>()
      const rtcConfig: RTCConfiguration = {
        iceServers: [
          {
            urls: [
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302',
            ],
          },
        ],
      }
      const pc = new RTCPeerConnection(rtcConfig)
      // console.log('Gathering IPs')
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const parts = e.candidate.candidate.split(' ')
          const ip = parts[4]
          // Filter out loopback
          if (ip && !ip.startsWith('127.') && ip !== '::1') {
            candidates.add(ip)
          }
        }
      }

      // Create dummy data channel to trigger ICE gathering
      pc.createDataChannel('dummy')
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {})

      // Timeout after 2 seconds
      setTimeout(() => {
        // console.log('Sending IPs', Array.from(candidates))
        pc.close()
        sendWs({
          type: 'register-ips',
          localIps: Array.from(candidates),
        })
        resolve()
      }, 2000)
    })
  }, [sendWs])

  // API

  const selectPeer = useCallback(
    (targetId: string) => {
      sendWs({ type: 'select-peer', targetId })
    },
    [sendWs],
  )

  const startOffer = useCallback(
    async (targetId: string, onDataChannel: (dc: RTCDataChannel) => void) => {
      pcRef.current?.close()
      pendingCandidatesRef.current = []
      pendingSignalsRef.current = []
      const rtcConfig: RTCConfiguration = {
        iceServers: [
          {
            urls: [
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302',
            ],
          },
        ],
      }

      const pc = new RTCPeerConnection(rtcConfig)
      pcRef.current = pc

      const dc = pc.createDataChannel('filetransfer', { ordered: true })
      onDataChannel(dc)

      pc.onicecandidate = (e) => {
        if (e.candidate)
          sendWs({
            type: 'signal',
            targetId,
            data: { kind: 'ice', candidate: e.candidate.toJSON() },
          })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendWs({
        type: 'signal',
        targetId,
        data: { kind: 'offer', sdp: offer.sdp! },
      })

      // Drain any signals that arrived during offer creation
      await drainPendingSignals(pc)
    },
    [sendWs],
  )

  const prepareAnswer = useCallback(
    async (fromId: string, onDataChannel: (dc: RTCDataChannel) => void) => {
      pcRef.current?.close()
      pendingCandidatesRef.current = []
      pendingSignalsRef.current = []

      const rtcConfig: RTCConfiguration = {
        iceServers: [
          {
            urls: [
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302',
            ],
          },
        ],
      }

      const pc = new RTCPeerConnection(rtcConfig)
      pcRef.current = pc

      pc.ondatachannel = (e) => onDataChannel(e.channel)
      pc.onicecandidate = (e) => {
        if (e.candidate)
          sendWs({
            type: 'signal',
            targetId: fromId,
            data: { kind: 'ice', candidate: e.candidate.toJSON() },
          })
      }

      await drainPendingSignals(pc)
    },
    [sendWs],
  )

  const notifyTransferComplete = useCallback(
    (targetId: string) => {
      sendWs({ type: 'transfer-complete', targetId })
    },
    [sendWs],
  )

  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    pendingSignalsRef.current = []
    pendingCandidatesRef.current = []
  }, [])

  return {
    myId,
    myName,
    peers,
    isConnected,
    error,
    selectPeer,
    startOffer,
    prepareAnswer,
    notifyTransferComplete,
    cleanup,
  }
}
