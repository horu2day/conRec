import mongoose from 'mongoose'
import { config } from '@/config'
import { logger } from '@/utils/logger'

// 모델들을 미리 import하여 스키마 등록
import { Room } from '@/models/Room'
import { RecordingFile } from '@/models/RecordingFile'

// MongoDB 연결 옵션
const mongooseOptions: mongoose.ConnectOptions = {
  // 연결 풀 설정
  maxPoolSize: 10, // 최대 연결 수
  minPoolSize: 2,  // 최소 연결 수
  maxIdleTimeMS: 30000, // 유휴 연결 제거 시간 (30초)
  
  // 연결 시간 제한
  serverSelectionTimeoutMS: 5000, // 서버 선택 시간 제한 (5초)
  socketTimeoutMS: 45000, // 소켓 시간 제한 (45초)
  connectTimeoutMS: 10000, // 연결 시간 제한 (10초)
  
  // 재시도 설정
  retryWrites: true,
  retryReads: true,
  
  // 압축 설정 (사용 가능한 경우만)
  compressors: ['zstd', 'zlib'],
  
  // 읽기 선호도
  readPreference: 'primary',
  
  // 새로운 URL parser 사용
  family: 4, // IPv4 사용
}

// 연결 이벤트 핸들러
const setupEventHandlers = (): void => {
  // 연결 성공
  mongoose.connection.on('connected', () => {
    logger.info('✅ MongoDB connected successfully')
  })

  // 연결 끊김
  mongoose.connection.on('disconnected', () => {
    logger.warn('❌ MongoDB disconnected')
  })

  // 재연결 시도
  mongoose.connection.on('reconnected', () => {
    logger.info('🔄 MongoDB reconnected')
  })

  // 연결 에러
  mongoose.connection.on('error', (error) => {
    logger.error('❌ MongoDB connection error:', error)
  })

  // 연결 종료
  mongoose.connection.on('close', () => {
    logger.info('🔒 MongoDB connection closed')
  })

  // 풀 생성됨
  mongoose.connection.on('fullsetup', () => {
    logger.info('📊 MongoDB replica set fully connected')
  })

  // 버퍼링 에러
  mongoose.connection.on('bufferMaxExceeded', () => {
    logger.error('⚠️ MongoDB buffer exceeded')
  })
}

// 데이터베이스 연결 함수
export const connectToDatabase = async (): Promise<void> => {
  try {
    // 이벤트 핸들러 설정
    setupEventHandlers()

    // 개발 환경에서만 디버그 모드 활성화 (로그 레벨이 DEBUG일 때만)
    if (config.isDevelopment && config.LOG_LEVEL === 'debug') {
      mongoose.set('debug', (collection, method, query, doc) => {
        logger.debug(`MongoDB: ${collection}.${method}`, {
          query: JSON.stringify(query),
          doc: doc ? JSON.stringify(doc) : undefined
        })
      })
    }

    // MongoDB 연결
    await mongoose.connect(config.MONGODB_URI, mongooseOptions)

    // 연결 상태 확인
    const dbState = mongoose.connection.readyState
    const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting']
    logger.info(`🔗 MongoDB connection state: ${stateNames[dbState]}`)

    // 데이터베이스 정보 로깅
    const db = mongoose.connection.db
    if (db) {
      const admin = db.admin()
      const serverStatus = await admin.serverStatus()
      
      logger.info('📊 Database info:', {
        host: serverStatus.host,
        version: serverStatus.version,
        uptime: serverStatus.uptime,
        connections: serverStatus.connections
      })
    }

  } catch (error) {
    logger.error('❌ Failed to connect to MongoDB:', error)
    throw error
  }
}

// 데이터베이스 연결 해제 함수
export const disconnectFromDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect()
    logger.info('🔌 Disconnected from MongoDB')
  } catch (error) {
    logger.error('❌ Error disconnecting from MongoDB:', error)
    throw error
  }
}

// 연결 상태 확인 함수
export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1
}

// 데이터베이스 상태 정보 반환
export const getDatabaseStatus = () => {
  const connection = mongoose.connection
  
  return {
    readyState: connection.readyState,
    host: connection.host,
    port: connection.port,
    name: connection.name,
    collections: Object.keys(connection.collections),
    models: Object.keys(mongoose.models)
  }
}

// Graceful shutdown을 위한 정리 함수
export const gracefulDatabaseShutdown = async (): Promise<void> => {
  try {
    logger.info('🔄 Starting graceful database shutdown...')
    
    // 진행 중인 작업이 완료될 때까지 대기
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 연결 해제
    await disconnectFromDatabase()
    
    logger.info('✅ Graceful database shutdown completed')
  } catch (error) {
    logger.error('❌ Error during graceful database shutdown:', error)
    throw error
  }
}

// 헬스체크 함수
export const checkDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy'
  details: any
}> => {
  try {
    if (!isDatabaseConnected()) {
      return {
        status: 'unhealthy',
        details: { message: 'Database not connected' }
      }
    }

    // 간단한 ping 테스트
    const admin = mongoose.connection.db!.admin()
    const pingResult = await admin.ping()
    
    // 연결 상태 정보
    const status = getDatabaseStatus()
    
    return {
      status: 'healthy',
      details: {
        ping: pingResult,
        connection: status,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }
}

// 인덱스 생성 함수
export const ensureIndexes = async (): Promise<void> => {
  try {
    logger.info('🔍 Creating database indexes...')
    
    // Room 모델 인덱스
    await Room.createIndexes()
    logger.info('✅ Room indexes created successfully')
    
    // RecordingFile 모델 인덱스
    await RecordingFile.createIndexes()
    logger.info('✅ RecordingFile indexes created successfully')
    
    logger.info('✅ Database indexes created successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    logger.error('❌ Error creating database indexes:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : 'Unknown'
    })
    
    throw error
  }
}
