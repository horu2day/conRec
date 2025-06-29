/**
 * HTTP API 서비스
 * Socket.io와 병행하여 회의방 정보를 HTTP로 조회
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 응답 인터셉터로 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 요청 실패:', error)
    return Promise.reject(error)
  }
)

export interface RoomInfo {
  id: string
  hostId: string
  participants: Array<{
    id: string
    name: string
    isHost: boolean
    joinedAt: string
    microphoneEnabled: boolean
    recordingStatus: string
  }>
  status: 'waiting' | 'recording' | 'ended'
  createdAt: string
  maxParticipants: number
  recordingStartedAt?: string
  recordingEndedAt?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
}

class ApiService {
  /**
   * 회의방 정보 조회
   */
  async getRoomInfo(roomId: string): Promise<ApiResponse<{ room: RoomInfo }>> {
    try {
      const response = await apiClient.get(`/rooms/${roomId}`)
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return {
            success: false,
            message: '존재하지 않는 회의방입니다.'
          }
        }
        return {
          success: false,
          message: error.response?.data?.message || '회의방 정보 조회에 실패했습니다.'
        }
      }
      return {
        success: false,
        message: '네트워크 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 회의방 생성 (HTTP)
   */
  async createRoom(hostName: string, maxParticipants = 10): Promise<ApiResponse<{
    room: RoomInfo
    hostUser: any
    joinUrl: string
  }>> {
    try {
      const response = await apiClient.post('/rooms', {
        hostName,
        maxParticipants
      })
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          message: error.response?.data?.message || '회의방 생성에 실패했습니다.'
        }
      }
      return {
        success: false,
        message: '네트워크 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 회의방 참여 (HTTP)
   */
  async joinRoom(roomId: string, userName: string): Promise<ApiResponse<{
    room: RoomInfo
    user: any
  }>> {
    try {
      const response = await apiClient.post(`/rooms/${roomId}/join`, {
        userName
      })
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          message: error.response?.data?.message || '회의방 참여에 실패했습니다.'
        }
      }
      return {
        success: false,
        message: '네트워크 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 회의방 나가기 (HTTP)
   */
  async leaveRoom(roomId: string, userId: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`/rooms/${roomId}/leave`, {
        userId
      })
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          message: error.response?.data?.message || '회의방 나가기에 실패했습니다.'
        }
      }
      return {
        success: false,
        message: '네트워크 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 건강 상태 확인
   */
  async checkHealth(): Promise<ApiResponse> {
    try {
      const response = await apiClient.get('/rooms/health')
      return response.data
    } catch (error) {
      return {
        success: false,
        message: '서버에 연결할 수 없습니다.'
      }
    }
  }
}

export const apiService = new ApiService()
export default apiService
