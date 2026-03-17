// ─────────────────────────────────────────────────────────────
// hooks/useSocket.ts
// Socket.io-client hook with auth, auto-reconnect, typed events
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// ── Event payloads ──────────────────────────────────────────
export interface NewReportEvent {
  id: string
  title: string
  category: string
  severity: number
  location: { lat: number; lng: number; address: string }
  createdAt: string
}

export interface StatusUpdateEvent {
  id: string
  status: string
  updatedAt: string
  message?: string
}

export interface WorkerLocationEvent {
  workerId: string
  workerName: string
  lat: number
  lng: number
  complaintId?: string
  eta?: string
}

export interface AnomalyAlertEvent {
  zone: string
  reportCount: number
  message: string
  lat: number
  lng: number
}

export interface ResolutionVerifiedEvent {
  id: string
  aiVerificationScore: number
  message: string
  afterPhotoUrl: string
}

export interface CommunityConfirmEvent {
  id: string
  confirmCount: number
  newSeverityBoost: number
}

export interface NotificationEvent {
  type: 'info' | 'warning' | 'success' | 'error'
  message: string
  timestamp: string
}

export type SocketEventMap = {
  'new-report':           NewReportEvent
  'status-update':        StatusUpdateEvent
  'worker-location':      WorkerLocationEvent
  'anomaly-alert':        AnomalyAlertEvent
  'resolution-verified':  ResolutionVerifiedEvent
  'community-confirm':    CommunityConfirmEvent
  'notification':         NotificationEvent
  'connect':              undefined
  'disconnect':           undefined
}

// ── Hook ────────────────────────────────────────────────────
interface UseSocketOptions {
  token?: string
  enabled?: boolean
  onNewReport?:          (d: NewReportEvent) => void
  onStatusUpdate?:       (d: StatusUpdateEvent) => void
  onWorkerLocation?:     (d: WorkerLocationEvent) => void
  onAnomalyAlert?:       (d: AnomalyAlertEvent) => void
  onResolutionVerified?: (d: ResolutionVerifiedEvent) => void
  onCommunityConfirm?:   (d: CommunityConfirmEvent) => void
  onNotification?:       (d: NotificationEvent) => void
  onConnect?:            () => void
  onDisconnect?:         () => void
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (options.enabled === false) return

    // Connect to backend (falls back gracefully when backend is offline)
    const socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:5000', {
      auth: { token: options.token ?? localStorage.getItem('civic_token') ?? '' },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    socket.on('connect',              () => options.onConnect?.())
    socket.on('disconnect',           () => options.onDisconnect?.())
    socket.on('new-report',           (d) => options.onNewReport?.(d))
    socket.on('status-update',        (d) => options.onStatusUpdate?.(d))
    socket.on('worker-location',      (d) => options.onWorkerLocation?.(d))
    socket.on('anomaly-alert',        (d) => options.onAnomalyAlert?.(d))
    socket.on('resolution-verified',  (d) => options.onResolutionVerified?.(d))
    socket.on('community-confirm',    (d) => options.onCommunityConfirm?.(d))
    socket.on('notification',         (d) => options.onNotification?.(d))

    return () => { socket.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.token, options.enabled])

  /** Emit helper */
  const emit = useCallback(<K extends string>(event: K, data?: unknown) => {
    socketRef.current?.emit(event, data)
  }, [])

  return { socket: socketRef, emit }
}
