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
        console.log('🔌 meetingStore.connect() 호출, 현재 연결 상태:', socketService.isConnected())
        
        // 이미 연결되어 있더라도 이벤트 리스너를 다시 등록해야 함
        console.log('🔄 Socket.io 이벤트 리스너 설정 시작...')
        
        if (socketService.isConnected()) {
          console.log('✅ 이미 Socket.io 연결됨 - 이벤트 리스너만 등록')
          set({
            isConnected: true,
            connectionError: null,
            isReconnecting: false
          })
          // 이벤트 리스너 등록을 위해 아래 코드 계속 실행
        } else {
          console.log('🔄 Socket.io 연결 시도 중...')
          set({ isReconnecting: true, connectionError: null })
        }
        
        // 기존 이벤트 리스너 정리 (중복 등록 방지)
        console.log('🧨 기존 이벤트 리스너 정리...')
        socketService.off('connect')
        socketService.off('disconnect')
        socketService.off('connect_error')
        socketService.off('participant-joined')
        socketService.off('participant-left')
        socketService.off('recording-started')
        socketService.off('recording-stopped')
        socketService.off('room-ended')
        socketService.off('error')
        
        // Socket.io 이벤트 리스너 설정
        console.log('🎯 Socket.io 이벤트 리스너 등록 시작...')
        
        socketService.on('connect', () => {
          console.log('✅ Socket.io connect 이벤트 발생')
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
        console.log('🎯 participant-joined 이벤트 리스너 등록')
        socketService.on('participant-joined', (data) => {
          console.log('🔔 participant-joined 이벤트 수신:', {
            data,
            participant: data.participant,
            room: data.room,
            roomInfo: data.roomInfo,
            현재방정보: get().currentRoom
          })
          
          // room 또는 roomInfo가 있으면 회의방 정보 업데이트
          const roomData = data.roomInfo || data.room
          if (roomData) {
            console.log('🔄 방 정보 업데이트 시도:', roomData)
            get().updateRoomInfo(roomData)
          } else {
            console.warn('⚠️ participant-joined 이벤트에 방 정보가 없음')
          }
          get().addNotification('info', `${data.participant.name}님이 입장했습니다.`)
        })

        socketService.on('participant-left', (data) => {
          console.log('🔔 participant-left 이벤트 수신:', {
            data,
            userId: data.userId,
            userName: data.userName,
            room: data.room,
            roomInfo: data.roomInfo,
            현재방정보: get().currentRoom
          })
          
          // room 또는 roomInfo가 있으면 회의방 정보 업데이트
          const roomData = data.roomInfo || data.room
          if (roomData) {
            console.log('🔄 방 정보 업데이트 시도 (left):', roomData)
            get().updateRoomInfo(roomData)
          } else {
            console.warn('⚠️ participant-left 이벤트에 방 정보가 없음')
          }
          get().addNotification('info', `${data.userName}님이 퇴장했습니다.`)
        })

        socketService.on('recording-started', (data) => {
          console.log('🔔 recording-started 이벤트 수신:', {
            data,
            startedAt: data.startedAt,
            timestamp: data.timestamp,
            roomInfo: data.roomInfo,
            현재녹음상태: get().isRecording
          })
          
          // 방 정보 업데이트
          if (data.roomInfo) {
            console.log('🔄 녹음 시작 - 방 정보 업데이트')
            get().updateRoomInfo(data.roomInfo)
          }
          
          // 녹음 상태 업데이트
          const startTime = new Date(data.startedAt || data.timestamp)
          set({
            isRecording: true,
            recordingStartTime: startTime,
            recordingDuration: 0
          })
          
          console.log('✅ 녹음 상태 업데이트 완료 - 녹음 시작됨')
          get().addNotification('success', '녹음이 시작되었습니다.')

          // 개별 녹음 시작
          get().startIndividualRecording()
        })

        socketService.on('recording-stopped', (data) => {
          console.log('🔔 recording-stopped 이벤트 수신:', {
            data,
            stoppedAt: data.stoppedAt,
            timestamp: data.timestamp,
            duration: data.duration,
            roomInfo: data.roomInfo,
            현재녹음상태: get().isRecording
          })
          
          // 방 정보 업데이트
          if (data.roomInfo) {
            console.log('🔄 녹음 중지 - 방 정보 업데이트')
            get().updateRoomInfo(data.roomInfo)
          }
          
          // 녹음 상태 업데이트
          set({
            isRecording: false,
            isPaused: false,
            recordingDuration: data.duration || get().recordingDuration
          })
          
          console.log('✅ 녹음 상태 업데이트 완료 - 녹음 중지됨')
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
        console.log('🎤 startIndividualRecording 시작')
        
        try {
          const { audioConfig, participantName, roomId } = get()
          console.log('📋 녹음 시작 정보:', {
            participantName,
            roomId,
            audioConfig,
            audioRecorder: !!audioRecorder
          })
          
          // AudioRecorder 인스턴스 생성 또는 재사용
          if (!audioRecorder) {
            console.log('🔧 새로운 AudioRecorderService 인스턴스 생성')
            audioRecorder = new AudioRecorderService(audioConfig)
          } else {
            console.log('♻️ 기존 AudioRecorderService 인스턴스 재사용')
          }

          // 브라우저 지원 확인
          console.log('🔍 브라우저 지원 확인...')
          const isSupported = audioRecorder.isSupported()
          if (!isSupported) {
            console.error('❌ 브라우저가 오디오 녹음을 지원하지 않음')
            get().addNotification('error', '이 브라우저는 오디오 녹음을 지원하지 않습니다.')
            return
          }
          console.log('✅ 브라우저 오디오 녹음 지원 확인됨')

          // 마이크 권한 요청
          console.log('🎤 마이크 권한 요청...')
          const hasPermission = await audioRecorder.requestPermission()
          console.log('🔐 마이크 권한 결과:', hasPermission)
          
          if (!hasPermission) {
            console.error('❌ 마이크 권한 거부됨')
            get().addNotification('error', '마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.')
            return
          }
          console.log('✅ 마이크 권한 획득 성공')

          // 녹음 시작
          console.log('▶️ 실제 녹음 시작 시도...')
          const started = await audioRecorder.startRecording()
          console.log('🎯 녹음 시작 결과:', started)
          
          if (started) {
            console.log('🎉 개별 녹음 시작 성공!')
            get().addNotification('success', '개별 녹음이 시작되었습니다.')
          } else {
            console.error('❌ 개별 녹음 시작 실패')
            get().addNotification('error', '개별 녹음 시작에 실패했습니다.')
          }
          
        } catch (error) {
          console.error('💥 개별 녹음 시작 중 예외 발생:', {
            error,
            message: error instanceof Error ? error.message : '알 수 없는 오류',
            stack: error instanceof Error ? error.stack : undefined
          })
          
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          get().addNotification('error', `개별 녹음 시작 실패: ${errorMessage}`)
        }
      },

      stopIndividualRecording: async () => {
        console.log('🛑 stopIndividualRecording 시작')
        
        try {
          const { participantName, roomId } = get()
          console.log('📋 녹음 중지 정보:', {
            participantName,
            roomId,
            audioRecorder: !!audioRecorder
          })
          
          if (!audioRecorder) {
            console.warn('⚠️ audioRecorder가 없음 - 녹음이 시작되지 않았거나 이미 중지됨')
            get().addNotification('warning', '녹음이 시작되지 않았습니다.')
            return
          }

          console.log('⏹️ 녹음 중지 시도...')
          const blob = await audioRecorder.stopRecording()
          console.log('📁 녹음 중지 결과:', {
            blob: !!blob,
            blobSize: blob ? blob.size : 0,
            blobType: blob ? blob.type : 'N/A'
          })
          
          if (blob && blob.size > 0) {
            console.log('💾 녹음 파일 생성 성공, 상태 업데이트')
            set({ audioBlob: blob })
            get().addNotification('success', '개별 녹음이 완료되었습니다.')
            
            // 서버로 파일 업로드
            console.log('☁️ 서버 업로드 시작...')
            const uploadResult = await get().uploadAudioFile(blob)
            console.log('📤 업로드 결과:', uploadResult)
            
          } else {
            console.warn('⚠️ 녹음 파일이 비어있거나 생성되지 않음')
            get().addNotification('warning', '녹음 파일이 생성되지 않았습니다.')
          }
          
        } catch (error) {
          console.error('💥 개별 녹음 중지 중 예외 발생:', {
            error,
            message: error instanceof Error ? error.message : '알 수 없는 오류',
            stack: error instanceof Error ? error.stack : undefined
          })
          
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
          get().addNotification('error', `개별 녹음 중지 실패: ${errorMessage}`)
        }
      },

      // 상태 업데이트
      updateRoomInfo: (room: RoomInfo) => {
        const currentState = get()
        console.log('📊 updateRoomInfo 호출:', {
          기존_참여자수: currentState.currentRoom?.participants?.length || 0,
          새로운_참여자수: room.participants?.length || 0,
          기존_참여자_목록: currentState.currentRoom?.participants?.map(p => p.name) || [],
          새로운_참여자_목록: room.participants?.map(p => p.name) || [],
          전체_방_정보: room
        })
        
        // 상태 업데이트 전후 비교
        set({ currentRoom: room })
        
        console.log('🔄 상태 업데이트 완료:', {
          업데이트_후_참여자수: get().currentRoom?.participants?.length || 0
        })
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
