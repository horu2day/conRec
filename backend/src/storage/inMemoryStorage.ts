/**
 * 개발 환경용 In-Memory 저장소
 * MongoDB 없이도 기본 기능 테스트 가능
 */

import { Room, RecordingFile } from '@/types'
import { logger } from '@/utils/logger'

// In-Memory 데이터 저장소
class InMemoryStorage {
  private rooms: Map<string, Room> = new Map()
  private recordingFiles: Map<string, RecordingFile> = new Map()

  // Room 관련 메서드
  async createRoom(room: Room): Promise<Room> {
    this.rooms.set(room.id, room)
    logger.debug(`In-Memory: Room created ${room.id}`)
    return room
  }

  async findRoomById(id: string): Promise<Room | null> {
    const room = this.rooms.get(id)
    logger.debug(`In-Memory: Room ${id} ${room ? 'found' : 'not found'}`)
    return room || null
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | null> {
    const room = this.rooms.get(id)
    if (!room) {
      logger.debug(`In-Memory: Room ${id} not found for update`)
      return null
    }

    const updatedRoom = { ...room, ...updates }
    this.rooms.set(id, updatedRoom)
    logger.debug(`In-Memory: Room ${id} updated`)
    return updatedRoom
  }

  async deleteRoom(id: string): Promise<boolean> {
    const result = this.rooms.delete(id)
    logger.debug(`In-Memory: Room ${id} ${result ? 'deleted' : 'not found'}`)
    return result
  }

  async getAllRooms(): Promise<Room[]> {
    const rooms = Array.from(this.rooms.values())
    logger.debug(`In-Memory: Found ${rooms.length} rooms`)
    return rooms
  }

  // RecordingFile 관련 메서드
  async createRecordingFile(file: RecordingFile): Promise<RecordingFile> {
    this.recordingFiles.set(file.id, file)
    logger.debug(`In-Memory: RecordingFile created ${file.id}`)
    return file
  }

  async findRecordingFileById(id: string): Promise<RecordingFile | null> {
    const file = this.recordingFiles.get(id)
    logger.debug(`In-Memory: RecordingFile ${id} ${file ? 'found' : 'not found'}`)
    return file || null
  }

  async findRecordingFilesByRoomId(roomId: string): Promise<RecordingFile[]> {
    const files = Array.from(this.recordingFiles.values())
      .filter(file => file.roomId === roomId)
    logger.debug(`In-Memory: Found ${files.length} files for room ${roomId}`)
    return files
  }

  async updateRecordingFile(id: string, updates: Partial<RecordingFile>): Promise<RecordingFile | null> {
    const file = this.recordingFiles.get(id)
    if (!file) {
      logger.debug(`In-Memory: RecordingFile ${id} not found for update`)
      return null
    }

    const updatedFile = { ...file, ...updates }
    this.recordingFiles.set(id, updatedFile)
    logger.debug(`In-Memory: RecordingFile ${id} updated`)
    return updatedFile
  }

  async deleteRecordingFile(id: string): Promise<boolean> {
    const result = this.recordingFiles.delete(id)
    logger.debug(`In-Memory: RecordingFile ${id} ${result ? 'deleted' : 'not found'}`)
    return result
  }

  // 통계 및 유틸리티 메서드
  getStats() {
    return {
      rooms: this.rooms.size,
      recordingFiles: this.recordingFiles.size,
      timestamp: new Date().toISOString()
    }
  }

  // 데이터 초기화 (테스트용)
  clear() {
    this.rooms.clear()
    this.recordingFiles.clear()
    logger.info('In-Memory: All data cleared')
  }

  // 개발용 샘플 데이터 생성
  async createSampleData(): Promise<void> {
    const sampleRoom: Room = {
      id: 'sample-room-123',
      hostId: 'host-user-1',
      status: 'waiting',
      participants: [
        {
          id: 'host-user-1',
          name: '테스트 진행자',
          isHost: true,
          joinedAt: new Date(),
          microphoneEnabled: true,
          recordingStatus: 'idle' as const
        }
      ],
      createdAt: new Date(),
      maxParticipants: 10
    }

    await this.createRoom(sampleRoom)
    logger.info('In-Memory: Sample data created')
  }
}

// 싱글톤 인스턴스
export const inMemoryStorage = new InMemoryStorage()

// 헬스체크 함수
export const checkInMemoryStorageHealth = () => {
  return {
    status: 'healthy' as const,
    details: {
      ...inMemoryStorage.getStats(),
      message: 'In-memory storage is running'
    }
  }
}
