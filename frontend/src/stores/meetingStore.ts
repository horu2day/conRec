/**
 * 회의실 상태 관리 스토어 (Zustand)
 * Socket.io와 AudioRecorder 통합 관리
 * 
 * 연구 결과 적용:
 * - Zustand 5.0.0 사용 (경량 상태 관리)
 * - 실시간 동기화 상태 관리
 * - 오류 처리 및 재연결 로직
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import socketService, { RoomInfo, ParticipantInfo } from '../services/socketService'
import AudioRecorderService from '../services/audioRecorderService'
import { uploadService, UploadProgress, UploadResult } from '../services/uploadService'

export interface MeetingState {
  // 연결 상태
  isConnected: boolean
  connectionError: string | null
  isReconnecting: boolean

  // 회의방 정보
  currentRoom: RoomInfo | null
  roomId: string | null
  isHost: boolean
  hostId: string | null
  participantId: string | null
  participantName: string | null

  // 녹음 상태
  isRecording: boolean
  isPaused: boolean
  recordingDuration: number
  recordingStartTime: Date | null
  audioBlob: Blob | null

  // UI 상태
  isLoading: boolean
  error: string | null
  showParticipants: boolean

  // 업로드 상태
  isUploading: boolean
  uploadProgress: UploadProgress | null
  uploadError: string | null
  uploadedFileId: string | null
  notifications: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    timestamp: Date
  }>

  // 오디오 설정
  audioConfig: {
    mimeType: string
    sampleRate: number
    bitRate: number
    numberOfChannels: number
  }
}

export interface MeetingActions {
  // 연결 관리
  connect: () => void
  disconnect: () => void
  reconnect: () => void

  // 회의방 관리
  createRoom: (hostName: string) => Promise<{ success: boolean; roomId?: string; error?: string }>
  joinRoom: (roomId: string, userName: string) => Promise<{ success: boolean; error?: string }>
  leaveRoom: () => void

  // 녹음 제어 (호스트만)
  startRecording: () => Promise<{ success: boolean; error?: string }>
  stopRecording: () => Promise<{ success: boolean; blob?: Blob; error?: string }>
  pauseRecording: () => Promise<{ success: boolean; error?: string }>
  resumeRecording: () => Promise<{ success: boolean; error?: string }>

  // 상태 업데이트
  updateRoomInfo: (room: RoomInfo) => void
  addParticipant: (participant: ParticipantInfo) => void
  removeParticipant: (participantId: string) => void
  setError: (error: string | null) => void
  clearError: () => void
  setLoading: (loading: boolean) => void
  addNotification: (type: MeetingState['notifications'][0]['type'], message: string) => void
  removeNotification: (id: string) => void
  toggleParticipants: () => void

  // 오디오 설정
  updateAudioConfig: (config: Partial<MeetingState['audioConfig']>) => void

  // 파일 업로드
  uploadAudioFile: (audioBlob: Blob) => Promise<UploadResult>
  setUploadProgress: (progress: UploadProgress | null) => void
  setUploadError: (error: string | null) => void
  clearUploadState: () => void
  
  // 초기화
  reset: () => void
}

// 오디오 레코더 인스턴스
let audioRecorder: AudioRecorderService | null = null

const initialState: MeetingState = {
  isConnected: false,
  connectionError: null,
  isReconnecting: false,
  currentRoom: null,
  roomId: null,
  isHost: false,
  hostId: null,
  participantId: null,
  participantName: null,
  isRecording: false,
  isPaused: false,
  recordingDuration: 0,
  recordingStartTime: null,
  audioBlob: null,
  isLoading: false,
  error: null,
  showParticipants: true,
  isUploading: false,
  uploadProgress: null,
  uploadError: null,
  uploadedFileId: null,
  notifications: [],
  audioConfig: {
    mimeType: 'audio/webm;codecs=opus',
    sampleRate: 44100,
    bitRate: 256000,
    numberOfChannels: 1
  }
}

export const useMeetingStore = create<MeetingState & MeetingActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 연결 관리
      connect: () => {
        set({ isReconnecting: true })
        
        // Socket.io 이벤트 리스너 설정
        socketService.on('connect', () => {
          set({
            isConnected: true,
            connectionError: null,
            isReconnecting: false
          })
          get().addNotification('success', '서버에 연결되었습니다.')
        })

        socketService.on('disconnect', (reason: string) => {
          set({
            isConnected: false,
            connectionError: `연결이 끊어졌습니다: ${reason}`,
            isReconnecting: true
          })
          get().addNotification('warning', '서버 연결이 끊어졌습니다. 재연결 중...')
        })

        socketService.on('connect_error', (error: Error) => {
          set({
            isConnected: false,
            connectionError: error.message,
            isReconnecting: false
          })
          get().addNotification('error', '서버 연결에 실패했습니다.')
        })

        // 실시간 이벤트 핸들러
        socketService.on('participant-joined', (data) => {
          get().updateRoomInfo(data.roomInfo)
          get().addNotification('info', `${data.participant.name}님이 입장했습니다.`)
        })

        socketService.on('participant-left', (data) => {
          get().updateRoomInfo(data.roomInfo)
          get().addNotification('info', `${data.participantName}님이 퇴장했습니다.`)
        })

        socketService.on('recording-started', (data) => {
          get().updateRoomInfo(data.roomInfo)
          set({
            isRecording: true,
            recordingStartTime: new Date(data.timestamp),
            recordingDuration: 0
          })
          get().addNotification('success', '녹음이 시작되었습니다.')

          // 개별 녹음 시작
          get().startIndividualRecording()
        })

        socketService.on('recording-stopped', (data) => {
          get().updateRoomInfo(data.roomInfo)
          set({
            isRecording: false,
            isPaused: false,
            recordingDuration: data.duration
          })
          get().addNotification('info', '녹음이 중지되었습니다.')

          // 개별 녹음 중지
          get().stopIndividualRecording()
        })

        socketService.on('room-ended', (data) => {
          set({
            currentRoom: null,
            roomId: null,
            isHost: false,
            hostId: null,
            isRecording: false,
            isPaused: false
          })
          get().addNotification('warning', '회의방이 종료되었습니다.')
        })

        socketService.on('error', (error: string) => {
          get().setError(error)
          get().addNotification('error', error)
        })
      },

      disconnect: () => {
        socketService.disconnect()
        if (audioRecorder) {
          audioRecorder.stopRecording()
        }
        set({
          isConnected: false,
          connectionError: null,
          isReconnecting: false
        })
      },

      reconnect: () => {
        socketService.reconnect()
        get().connect()
      },

      // 회의방 관리
      createRoom: async (hostName: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await socketService.createRoom(hostName)
          
          if (response.success && response.data) {
            set({
              currentRoom: response.data.room,
              roomId: response.data.roomId,
              isHost: true,
              hostId: response.data.hostId,
              participantId: response.data.hostId,
              participantName: hostName,
              isLoading: false
            })
            
            get().addNotification('success', '회의방이 생성되었습니다.')
            return { success: true, roomId: response.data.roomId }
          } else {
            const error = response.error || '회의방 생성에 실패했습니다.'
            set({ error, isLoading: false })
            return { success: false, error }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          set({ error: errorMessage, isLoading: false })
          return { success: false, error: errorMessage }
        }
      },

      joinRoom: async (roomId: string, userName: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await socketService.joinRoom(roomId, userName)
          
          if (response.success && response.data) {
            set({
              currentRoom: response.data.room,
              roomId: roomId,
              isHost: false,
              hostId: response.data.room.hostId,
              participantId: response.data.participantId,
              participantName: userName,
              isLoading: false
            })
            
            get().addNotification('success', '회의방에 참여했습니다.')
            return { success: true }
          } else {
            const error = response.error || '회의방 참여에 실패했습니다.'
            set({ error, isLoading: false })
            return { success: false, error }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          set({ error: errorMessage, isLoading: false })
          return { success: false, error: errorMessage }
        }
      },

      leaveRoom: () => {
        const { roomId, participantId } = get()
        if (roomId && participantId) {
          socketService.leaveRoom(roomId, participantId)
        }
        
        if (audioRecorder) {
          audioRecorder.stopRecording()
        }
        
        set({
          currentRoom: null,
          roomId: null,
          isHost: false,
          hostId: null,
          participantId: null,
          participantName: null,
          isRecording: false,
          isPaused: false,
          recordingDuration: 0,
          recordingStartTime: null,
          audioBlob: null
        })
      },

      // 녹음 제어 (호스트만)
      startRecording: async () => {
        const { roomId, hostId, isHost } = get()
        
        if (!isHost) {
          return { success: false, error: '호스트만 녹음을 시작할 수 있습니다.' }
        }
        
        if (!roomId || !hostId) {
          return { success: false, error: '회의방 정보가 없습니다.' }
        }
        
        set({ isLoading: true, error: null })
        
        try {
          const response = await socketService.startRecording(roomId, hostId)
          
          if (response.success) {
            set({ isLoading: false })
            return { success: true }
          } else {
            const error = response.error || '녹음 시작에 실패했습니다.'
            set({ error, isLoading: false })
            return { success: false, error }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          set({ error: errorMessage, isLoading: false })
          return { success: false, error: errorMessage }
        }
      },

      stopRecording: async () => {
        const { roomId, hostId, isHost } = get()
        
        if (!isHost) {
          return { success: false, error: '호스트만 녹음을 중지할 수 있습니다.' }
        }
        
        if (!roomId || !hostId) {
          return { success: false, error: '회의방 정보가 없습니다.' }
        }
        
        set({ isLoading: true, error: null })
        
        try {
          const response = await socketService.stopRecording(roomId, hostId)
          
          if (response.success) {
            set({ isLoading: false })
            return { success: true }
          } else {
            const error = response.error || '녹음 중지에 실패했습니다.'
            set({ error, isLoading: false })
            return { success: false, error }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          set({ error: errorMessage, isLoading: false })
          return { success: false, error: errorMessage }
        }
      },

      pauseRecording: async () => {
        // TODO: Socket.io에 pause 이벤트 추가 필요
        if (audioRecorder) {
          const success = audioRecorder.pauseRecording()
          if (success) {
            set({ isPaused: true })
            return { success: true }
          }
        }
        return { success: false, error: '녹음 일시정지에 실패했습니다.' }
      },

      resumeRecording: async () => {
        // TODO: Socket.io에 resume 이벤트 추가 필요
        if (audioRecorder) {
          const success = audioRecorder.resumeRecording()
          if (success) {
            set({ isPaused: false })
            return { success: true }
          }
        }
        return { success: false, error: '녹음 재개에 실패했습니다.' }
      },

      // 개별 녹음 관리 (내부 메서드)
      startIndividualRecording: async () => {
        try {
          const { audioConfig } = get()
          
          if (!audioRecorder) {
            audioRecorder = new AudioRecorderService(audioConfig)
          }

          // 권한 확인
          const hasPermission = await audioRecorder.requestPermission()
          if (!hasPermission) {
            get().addNotification('error', '마이크 권한이 필요합니다.')
            return
          }

          // 녹음 시작
          const started = await audioRecorder.startRecording()
          if (!started) {
            get().addNotification('error', '개별 녹음 시작에 실패했습니다.')
          }
        } catch (error) {
          console.error('개별 녹음 시작 오류:', error)
          get().addNotification('error', '개별 녹음 시작에 실패했습니다.')
        }
      },

      stopIndividualRecording: async () => {
        try {
          if (audioRecorder) {
            const blob = await audioRecorder.stopRecording()
            if (blob) {
              set({ audioBlob: blob })
              get().addNotification('success', '개별 녹음 파일이 생성되었습니다.')
              
              // 서버로 파일 업로드
              await get().uploadAudioFile(blob)
            }
          }
        } catch (error) {
          console.error('개별 녹음 중지 오류:', error)
          get().addNotification('error', '개별 녹음 중지에 실패했습니다.')
        }
      },

      // 상태 업데이트
      updateRoomInfo: (room: RoomInfo) => {
        set({ currentRoom: room })
      },

      addParticipant: (participant: ParticipantInfo) => {
        const { currentRoom } = get()
        if (currentRoom) {
          const existingIndex = currentRoom.participants.findIndex(p => p.id === participant.id)
          if (existingIndex === -1) {
            const updatedRoom = {
              ...currentRoom,
              participants: [...currentRoom.participants, participant],
              participantCount: currentRoom.participantCount + 1
            }
            set({ currentRoom: updatedRoom })
          }
        }
      },

      removeParticipant: (participantId: string) => {
        const { currentRoom } = get()
        if (currentRoom) {
          const updatedRoom = {
            ...currentRoom,
            participants: currentRoom.participants.filter(p => p.id !== participantId),
            participantCount: currentRoom.participantCount - 1
          }
          set({ currentRoom: updatedRoom })
        }
      },

      setError: (error: string | null) => {
        set({ error })
      },

      clearError: () => {
        set({ error: null })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      addNotification: (type, message) => {
        const notification = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          type,
          message,
          timestamp: new Date()
        }
        
        set(state => ({
          notifications: [notification, ...state.notifications].slice(0, 5) // 최대 5개 유지
        }))

        // 자동 제거 (5초 후)
        setTimeout(() => {
          get().removeNotification(notification.id)
        }, 5000)
      },

      removeNotification: (id: string) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }))
      },

      toggleParticipants: () => {
        set(state => ({ showParticipants: !state.showParticipants }))
      },

      // 오디오 설정
      updateAudioConfig: (config) => {
        set(state => ({
          audioConfig: { ...state.audioConfig, ...config }
        }))
      },

      // 파일 업로드
      uploadAudioFile: async (audioBlob: Blob): Promise<UploadResult> => {
        const { roomId, participantId, participantName, recordingDuration } = get()
        
        if (!roomId || !participantId || !participantName) {
          const error = '회의방 정보가 없습니다.'
          get().setUploadError(error)
          return { success: false, message: error }
        }
        
        set({ isUploading: true, uploadError: null, uploadProgress: null })
        get().addNotification('info', '파일 업로드를 시작합니다...')
        
        try {
          const result = await uploadService.uploadAudioFile(
            audioBlob,
            roomId,
            participantId,
            participantName,
            recordingDuration,
            (progress: UploadProgress) => {
              get().setUploadProgress(progress)
            }
          )
          
          if (result.success) {
            set({ 
              isUploading: false,
              uploadedFileId: result.data?.fileId || null,
              uploadProgress: null
            })
            get().addNotification('success', '파일 업로드가 완료되었습니다.')
          } else {
            set({ isUploading: false })
            get().setUploadError(result.message)
            get().addNotification('error', `업로드 실패: ${result.message}`)
          }
          
          return result
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          set({ isUploading: false })
          get().setUploadError(errorMessage)
          get().addNotification('error', `업로드 오류: ${errorMessage}`)
          
          return { success: false, message: errorMessage }
        }
      },

      setUploadProgress: (progress: UploadProgress | null) => {
        set({ uploadProgress: progress })
      },

      setUploadError: (error: string | null) => {
        set({ uploadError: error })
      },

      clearUploadState: () => {
        set({
          isUploading: false,
          uploadProgress: null,
          uploadError: null,
          uploadedFileId: null
        })
      },

      // 초기화
      reset: () => {
        if (audioRecorder) {
          audioRecorder.stopRecording()
          audioRecorder = null
        }
        socketService.disconnect()
        set(initialState)
      }
    }),
    {
      name: 'meeting-store',
      // Redux DevTools에서 확인 가능
    }
  )
)

export default useMeetingStore
