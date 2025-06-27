import { Socket } from 'socket.io'

// 사용자 관련 타입
export interface User {
  id: string
  name: string
  isHost: boolean
  joinedAt: Date
  microphoneEnabled: boolean
  recordingStatus: RecordingStatus
  socketId?: string
}

// 회의방 관련 타입
export interface Room {
  id: string
  hostId: string
  participants: User[]
  status: RoomStatus
  createdAt: Date
  recordingStartedAt?: Date
  recordingEndedAt?: Date
  maxParticipants: number
}

// 상태 관련 타입
export type RoomStatus = 'waiting' | 'recording' | 'ended'
export type RecordingStatus = 'idle' | 'recording' | 'uploading' | 'completed' | 'error'

// 녹음 파일 관련 타입
export interface RecordingFile {
  id: string
  roomId: string
  userId: string
  fileName: string
  originalName: string
  mimeType: string
  size: number
  duration?: number
  filePath: string
  uploadedAt: Date
  transcription?: TranscriptionResult
}

// STT 결과 타입
export interface TranscriptionResult {
  text: string
  confidence: number
  language?: string
  segments?: TranscriptionSegment[]
  processedAt: Date
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  confidence: number
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
  'upload-progress': (data: { userId: string; progress: number }) => void
  'transcription-completed': (data: { userId: string; transcription: TranscriptionResult }) => void
  'error': (error: { message: string; code?: string }) => void
}

export interface ClientToServerEvents {
  'join-room': (data: { roomId: string; userName: string }, callback: (response: { success: boolean; error?: string; data?: any }) => void) => void
  'leave-room': (roomId: string) => void
  'start-recording': (roomId: string) => void
  'stop-recording': (roomId: string) => void
  'update-participant-status': (data: { microphoneEnabled?: boolean; recordingStatus?: RecordingStatus }) => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  userId: string
  roomId: string
  userName: string
  isHost: boolean
}

// API 요청/응답 타입
export interface CreateRoomRequest {
  hostName: string
  maxParticipants?: number
}

export interface CreateRoomResponse {
  room: Room
  hostUser: User
}

export interface JoinRoomRequest {
  roomId: string
  userName: string
}

export interface JoinRoomResponse {
  room: Room
  user: User
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 에러 타입
export interface AppError extends Error {
  statusCode: number
  code?: string
  isOperational: boolean
}

// Express Request 확장
export interface AuthenticatedRequest extends Express.Request {
  user?: User
  room?: Room
}

// 환경 변수 타입
export interface ProcessEnv {
  NODE_ENV: 'development' | 'production' | 'test'
  PORT: string
  MONGODB_URI: string
  JWT_SECRET: string
  JWT_EXPIRES_IN: string
  CORS_ORIGIN: string
  UPLOAD_DIR: string
  MAX_FILE_SIZE: string
  ALLOWED_FILE_TYPES: string
  OPENAI_API_KEY: string
  LOG_LEVEL: string
  RATE_LIMIT_WINDOW_MS: string
  RATE_LIMIT_MAX_REQUESTS: string
  MAX_PARTICIPANTS_PER_ROOM: string
  MAX_RECORDING_DURATION_MS: string
}

// 파일 업로드 관련 타입
export interface UploadedFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  destination: string
  filename: string
  path: string
  size: number
}

// 회의 세션 관리 타입
export interface MeetingSession {
  roomId: string
  participants: Map<string, User>
  status: RoomStatus
  startTime: Date
  endTime?: Date
  recordingFiles: RecordingFile[]
}

// Socket 타입 확장
export type AuthenticatedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
