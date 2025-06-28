/**
 * 통합 저장소 서비스
 * MongoDB가 사용 가능하면 MongoDB를 사용하고, 
 * 아니면 In-Memory 저장소를 사용
 */

import mongoose from 'mongoose'
import { Room, RecordingFile } from '@/types'
import { inMemoryStorage } from './inMemoryStorage'
import { logger } from '@/utils/logger'

// 저장소 인터페이스
interface StorageAdapter {
  // Room 관련 메서드
  createRoom(room: Room): Promise<Room>
  findRoomById(id: string): Promise<Room | null>
  updateRoom(id: string, updates: Partial<Room>): Promise<Room | null>
  deleteRoom(id: string): Promise<boolean>
  getAllRooms(): Promise<Room[]>

  // RecordingFile 관련 메서드
  createRecordingFile(file: RecordingFile): Promise<RecordingFile>
  findRecordingFileById(id: string): Promise<RecordingFile | null>
  findRecordingFilesByRoomId(roomId: string): Promise<RecordingFile[]>
  updateRecordingFile(id: string, updates: Partial<RecordingFile>): Promise<RecordingFile | null>
  deleteRecordingFile(id: string): Promise<boolean>

  // 헬스체크
  checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }>
}

// MongoDB 어댑터
class MongoDBAdapter implements StorageAdapter {
  private Room: any
  private RecordingFile: any

  constructor() {
    // Mongoose 모델들을 lazy load
    this.Room = null
    this.RecordingFile = null
  }

  private async getModels() {
    if (!this.Room) {
      const { Room } = await import('@/models/Room')
      this.Room = Room
    }
    if (!this.RecordingFile) {
      const { RecordingFile } = await import('@/models/RecordingFile')
      this.RecordingFile = RecordingFile
    }
  }

  async createRoom(room: Room): Promise<Room> {
    await this.getModels()
    const newRoom = new this.Room(room)
    const saved = await newRoom.save()
    return saved.toObject()
  }

  async findRoomById(id: string): Promise<Room | null> {
    await this.getModels()
    const room = await this.Room.findByRoomId(id)
    return room ? room.toObject() : null
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | null> {
    await this.getModels()
    const room = await this.Room.findOneAndUpdate(
      { id },
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
    return room ? room.toObject() : null
  }

  async deleteRoom(id: string): Promise<boolean> {
    await this.getModels()
    const result = await this.Room.deleteOne({ id })
    return result.deletedCount > 0
  }

  async getAllRooms(): Promise<Room[]> {
    await this.getModels()
    const rooms = await this.Room.find().sort({ createdAt: -1 })
    return rooms.map((room: any) => room.toObject())
  }

  async createRecordingFile(file: RecordingFile): Promise<RecordingFile> {
    await this.getModels()
    const newFile = new this.RecordingFile(file)
    const saved = await newFile.save()
    return saved.toObject()
  }

  async findRecordingFileById(id: string): Promise<RecordingFile | null> {
    await this.getModels()
    const file = await this.RecordingFile.findOne({ id })
    return file ? file.toObject() : null
  }

  async findRecordingFilesByRoomId(roomId: string): Promise<RecordingFile[]> {
    await this.getModels()
    const files = await this.RecordingFile.find({ roomId }).sort({ uploadedAt: -1 })
    return files.map((file: any) => file.toObject())
  }

  async updateRecordingFile(id: string, updates: Partial<RecordingFile>): Promise<RecordingFile | null> {
    await this.getModels()
    const file = await this.RecordingFile.findOneAndUpdate(
      { id },
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
    return file ? file.toObject() : null
  }

  async deleteRecordingFile(id: string): Promise<boolean> {
    await this.getModels()
    const result = await this.RecordingFile.deleteOne({ id })
    return result.deletedCount > 0
  }

  async checkHealth() {
    try {
      if (mongoose.connection.readyState !== 1) {
        return {
          status: 'unhealthy' as const,
          details: { message: 'MongoDB not connected' }
        }
      }

      const admin = mongoose.connection.db!.admin()
      const pingResult = await admin.ping()

      return {
        status: 'healthy' as const,
        details: {
          ping: pingResult,
          connection: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy' as const,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }
    }
  }
}

// In-Memory 어댑터 래퍼
class InMemoryAdapter implements StorageAdapter {
  async createRoom(room: Room): Promise<Room> {
    return inMemoryStorage.createRoom(room)
  }

  async findRoomById(id: string): Promise<Room | null> {
    return inMemoryStorage.findRoomById(id)
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | null> {
    return inMemoryStorage.updateRoom(id, updates)
  }

  async deleteRoom(id: string): Promise<boolean> {
    return inMemoryStorage.deleteRoom(id)
  }

  async getAllRooms(): Promise<Room[]> {
    return inMemoryStorage.getAllRooms()
  }

  async createRecordingFile(file: RecordingFile): Promise<RecordingFile> {
    return inMemoryStorage.createRecordingFile(file)
  }

  async findRecordingFileById(id: string): Promise<RecordingFile | null> {
    return inMemoryStorage.findRecordingFileById(id)
  }

  async findRecordingFilesByRoomId(roomId: string): Promise<RecordingFile[]> {
    return inMemoryStorage.findRecordingFilesByRoomId(roomId)
  }

  async updateRecordingFile(id: string, updates: Partial<RecordingFile>): Promise<RecordingFile | null> {
    return inMemoryStorage.updateRecordingFile(id, updates)
  }

  async deleteRecordingFile(id: string): Promise<boolean> {
    return inMemoryStorage.deleteRecordingFile(id)
  }

  async checkHealth() {
    return {
      status: 'healthy' as const,
      details: {
        ...inMemoryStorage.getStats(),
        message: 'In-memory storage is running',
        timestamp: new Date().toISOString()
      }
    }
  }
}

// 저장소 서비스 클래스
class StorageService {
  private adapter: StorageAdapter
  private isMongoDBConnected = false

  constructor() {
    // 초기화 시점에서는 MongoDB 연결 상태를 확인할 수 없으므로
    // 첫 번째 요청에서 어댑터를 결정
    this.adapter = new InMemoryAdapter()
  }

  // MongoDB 연결 상태 확인 후 적절한 어댑터 선택
  private async ensureAdapter(): Promise<void> {
    const isConnected = mongoose.connection.readyState === 1
    
    // MongoDB 연결 상태가 변경되었으면 어댑터 교체
    if (isConnected !== this.isMongoDBConnected) {
      this.isMongoDBConnected = isConnected
      
      if (isConnected) {
        logger.info('✅ Switching to MongoDB adapter')
        this.adapter = new MongoDBAdapter()
      } else {
        logger.warn('⚠️ Switching to In-Memory adapter')
        this.adapter = new InMemoryAdapter()
        
        // 개발 환경에서는 샘플 데이터 생성
        if (process.env.NODE_ENV === 'development') {
          await inMemoryStorage.createSampleData()
        }
      }
    }
  }

  // 퍼블릭 메서드들 - 모두 어댑터로 위임
  async createRoom(room: Room): Promise<Room> {
    await this.ensureAdapter()
    return this.adapter.createRoom(room)
  }

  async findRoomById(id: string): Promise<Room | null> {
    await this.ensureAdapter()
    return this.adapter.findRoomById(id)
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | null> {
    await this.ensureAdapter()
    return this.adapter.updateRoom(id, updates)
  }

  async deleteRoom(id: string): Promise<boolean> {
    await this.ensureAdapter()
    return this.adapter.deleteRoom(id)
  }

  async getAllRooms(): Promise<Room[]> {
    await this.ensureAdapter()
    return this.adapter.getAllRooms()
  }

  async createRecordingFile(file: RecordingFile): Promise<RecordingFile> {
    await this.ensureAdapter()
    return this.adapter.createRecordingFile(file)
  }

  async findRecordingFileById(id: string): Promise<RecordingFile | null> {
    await this.ensureAdapter()
    return this.adapter.findRecordingFileById(id)
  }

  async findRecordingFilesByRoomId(roomId: string): Promise<RecordingFile[]> {
    await this.ensureAdapter()
    return this.adapter.findRecordingFilesByRoomId(roomId)
  }

  async updateRecordingFile(id: string, updates: Partial<RecordingFile>): Promise<RecordingFile | null> {
    await this.ensureAdapter()
    return this.adapter.updateRecordingFile(id, updates)
  }

  async deleteRecordingFile(id: string): Promise<boolean> {
    await this.ensureAdapter()
    return this.adapter.deleteRecordingFile(id)
  }

  async checkHealth() {
    await this.ensureAdapter()
    const adapterHealth = await this.adapter.checkHealth()
    
    return {
      ...adapterHealth,
      details: {
        ...adapterHealth.details,
        adapter: this.isMongoDBConnected ? 'MongoDB' : 'In-Memory',
        isMongoDBConnected: this.isMongoDBConnected
      }
    }
  }

  // 현재 사용 중인 어댑터 정보
  getCurrentAdapter(): string {
    return this.isMongoDBConnected ? 'MongoDB' : 'In-Memory'
  }
}

// 싱글톤 인스턴스 생성
export const storageService = new StorageService()

// 헬스체크 함수 export
export const checkStorageHealth = () => storageService.checkHealth()
