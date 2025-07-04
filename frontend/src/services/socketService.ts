/**
 * Socket.io 클라이언트 서비스
 * 실시간 회의실 통신 관리
 * 
 * 연구 결과 적용:
 * - Socket.io-client 4.8.0 사용
 * - 자동 재연결 기능
 * - 하트비트 구현으로 연결 상태 모니터링
 * - 이벤트 기반 상태 관리
 */

import { io, Socket } from 'socket.io-client'

export interface ParticipantInfo {
  id: string
  name: string
  isHost: boolean
  joinedAt: string
  recordingStatus: 'idle' | 'recording' | 'paused' | 'stopped'
}

export interface RoomInfo {
  id: string
  hostId: string
  status: 'waiting' | 'recording' | 'paused' | 'ended'
  participantCount: number
  participants: ParticipantInfo[]
  createdAt: string
  recordingDuration: number
  recordingStartTime?: string
}

export interface SocketResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

// Socket.io 이벤트 타입 정의
interface ServerToClientEvents {
  'participant-joined': (data: { participant: ParticipantInfo; roomInfo: RoomInfo }) => void
  'participant-left': (data: { participantId: string; participantName: string; roomInfo: RoomInfo }) => void
  'recording-started': (data: { timestamp: string; roomInfo: RoomInfo }) => void
  'recording-stopped': (data: { timestamp: string; duration: number; roomInfo: RoomInfo }) => void
  'room-ended': (data: { timestamp: string; totalDuration: number }) => void
  'heartbeat-response': (data: { timestamp: string }) => void
  'error': (error: string) => void
  'connect': () => void
  'disconnect': (reason: string) => void
  'connect_error': (error: Error) => void
}

interface ClientToServerEvents {
  'create-room': (data: { hostName: string }, callback: (response: SocketResponse<{ roomId: string; hostId: string; room: RoomInfo }>) => void) => void
  'join-room': (data: { roomId: string; userName: string }, callback: (response: SocketResponse<{ participantId: string; room: RoomInfo }>) => void) => void
  'start-recording': (data: { roomId: string; hostId: string }, callback: (response: SocketResponse<{ timestamp: string }>) => void) => void
  'stop-recording': (data: { roomId: string; hostId: string }, callback: (response: SocketResponse<{ timestamp: string; duration: number }>) => void) => void
  'leave-room': (data: { roomId: string; participantId: string }) => void
  'heartbeat': () => void
}

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
  private connected = false
  private heartbeatInterval: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  // 이벤트 리스너 저장
  private eventListeners: Map<string, Function[]> = new Map()

  constructor() {
    // 기본 환경변수에서 URL 가져오기
    let serverUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    
    // URL에 포함된 /socket.io 경로를 제거
    if (serverUrl.endsWith('/socket.io')) {
      serverUrl = serverUrl.slice(0, -'/socket.io'.length);
    }

    this.connect(serverUrl);
  }

  private connect(url: string): void {
    try {
      this.socket = io(url, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        forceNew: true
      })

      this.setupEventHandlers()
      
    } catch (error) {
      console.error('Socket 연결 실패:', error)
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('Socket 연결됨:', this.socket?.id)
      this.connected = true
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.emit('connect')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket 연결 해제:', reason)
      this.connected = false
      this.stopHeartbeat()
      this.emit('disconnect', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket 연결 오류:', error)
      this.connected = false
      this.reconnectAttempts++
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('최대 재연결 시도 횟수 초과')
        this.emit('connect_error', error)
      }
    })

    // 실시간 이벤트 핸들러
    this.socket.on('participant-joined', (data) => {
      console.log('참여자 입장:', data.participant.name)
      this.emit('participant-joined', data)
    })

    this.socket.on('participant-left', (data) => {
      console.log('참여자 퇴장:', data.participantName)
      this.emit('participant-left', data)
    })

    this.socket.on('recording-started', (data) => {
      console.log('녹음 시작:', data.timestamp)
      this.emit('recording-started', data)
    })

    this.socket.on('recording-stopped', (data) => {
      console.log('녹음 중지:', data.timestamp, '지속시간:', data.duration)
      this.emit('recording-stopped', data)
    })

    this.socket.on('room-ended', (data) => {
      console.log('회의방 종료:', data.timestamp)
      this.emit('room-ended', data)
    })

    this.socket.on('heartbeat-response', (data) => {
      // 연결 상태 확인용 (로그 제거)
      this.emit('heartbeat-response', data)
    })

    this.socket.on('error', (error) => {
      console.error('Socket 오류:', error)
      this.emit('error', error)
    })
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('heartbeat')
      }
    }, 30000) // 30초마다 하트비트
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // 이벤트 리스너 관리
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  public off(event: string, callback?: Function): void {
    if (!callback) {
      this.eventListeners.delete(event)
      return
    }

    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`이벤트 ${event} 핸들러 오류:`, error)
        }
      })
    }
  }

  // API 메서드들
  public async createRoom(hostName: string): Promise<SocketResponse<{ roomId: string; hostId: string; room: RoomInfo }>> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Socket이 연결되지 않았습니다.'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('요청 시간 초과'))
      }, 10000)

      this.socket.emit('create-room', { hostName }, (response) => {
        clearTimeout(timeout)
        resolve(response)
      })
    })
  }

  public async joinRoom(roomId: string, userName: string): Promise<SocketResponse<{ participantId: string; room: RoomInfo }>> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Socket이 연결되지 않았습니다.'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('요청 시간 초과'))
      }, 10000)

      this.socket.emit('join-room', { roomId, userName }, (response) => {
        clearTimeout(timeout)
        resolve(response)
      })
    })
  }

  public async startRecording(roomId: string, hostId: string): Promise<SocketResponse<{ timestamp: string }>> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Socket이 연결되지 않았습니다.'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('요청 시간 초과'))
      }, 5000)

      this.socket.emit('start-recording', { roomId, hostId }, (response) => {
        clearTimeout(timeout)
        resolve(response)
      })
    })
  }

  public async stopRecording(roomId: string, hostId: string): Promise<SocketResponse<{ timestamp: string; duration: number }>> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Socket이 연결되지 않았습니다.'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('요청 시간 초과'))
      }, 5000)

      this.socket.emit('stop-recording', { roomId, hostId }, (response) => {
        clearTimeout(timeout)
        resolve(response)
      })
    })
  }

  public leaveRoom(roomId: string, participantId: string): void {
    if (this.socket && this.connected) {
      this.socket.emit('leave-room', { roomId, participantId })
    }
  }

  // 연결 상태 확인
  public isConnected(): boolean {
    return this.connected && this.socket?.connected === true
  }

  public getSocketId(): string | undefined {
    return this.socket?.id
  }

  // 연결 종료
  public disconnect(): void {
    this.stopHeartbeat()
    
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    
    this.connected = false
    this.eventListeners.clear()
  }

  // 수동 재연결
  public reconnect(): void {
    if (this.socket) {
      this.socket.connect()
    }
  }
}

// 싱글톤 인스턴스
const socketService = new SocketService()

export default socketService
export { SocketService }
