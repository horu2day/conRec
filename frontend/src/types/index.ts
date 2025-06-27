// 사용자 관련 타입
export interface User {
  id: string
  name: string
  isHost: boolean
  joinedAt: Date
  microphoneEnabled: boolean
  recordingStatus: RecordingStatus
}

// 회의방 관련 타입
export interface Room {
  id: string
  hostId: string
  participants: User[]
  status: RoomStatus
  createdAt: Date
  recordingStartedAt?: Date
  maxParticipants: number
}

// 상태 관련 타입
export type RoomStatus = 'waiting' | 'recording' | 'ended'
export type RecordingStatus = 'idle' | 'recording' | 'uploading' | 'completed' | 'error'

// 녹음 관련 타입
export interface RecordingData {
  userId: string
  roomId: string
  blob: Blob
  duration: number
  fileName: string
  createdAt: Date
}

// Socket 이벤트 타입
export interface ServerToClientEvents {
  'room-joined': (data: { room: Room; user: User }) => void
  'participant-joined': (user: User) => void
  'participant-left': (userId: string) => void
  'recording-started': () => void
  'recording-stopped': () => void
  'participant-status-changed': (data: { userId: string; status: Partial<User> }) => void
  'room-status-changed': (status: RoomStatus) => void
  'error': (error: { message: string; code?: string }) => void
}

export interface ClientToServerEvents {
  'join-room': (data: { roomId: string; userName: string }) => void
  'leave-room': (roomId: string) => void
  'start-recording': (roomId: string) => void
  'stop-recording': (roomId: string) => void
  'update-participant-status': (data: { microphoneEnabled?: boolean; recordingStatus?: RecordingStatus }) => void
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 회의방 생성 요청/응답
export interface CreateRoomRequest {
  hostName: string
  maxParticipants?: number
}

export interface CreateRoomResponse {
  room: Room
  hostUser: User
}

// 녹음 업로드 응답
export interface UploadResponse {
  fileId: string
  fileName: string
  fileSize: number
  uploadedAt: Date
}

// STT 응답
export interface TranscriptionResponse {
  text: string
  confidence: number
  words?: {
    word: string
    start: number
    end: number
    confidence: number
  }[]
}

// 환경 변수 타입
export interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SOCKET_URL: string
  readonly VITE_MAX_PARTICIPANTS: string
  readonly VITE_MAX_RECORDING_TIME: string
  readonly VITE_UPLOAD_CHUNK_SIZE: string
}

// 녹음 설정 타입
export interface RecordingConfig {
  mimeType: string
  audioBitsPerSecond?: number
  sampleRate: number
  numberOfChannels: number
}

// 에러 타입
export interface AppError {
  code: string
  message: string
  details?: any
}
