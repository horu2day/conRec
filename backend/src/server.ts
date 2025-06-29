import { httpServer } from './app'
import { config } from './config/index'
import { logger } from './utils/logger'
import { ensureDirectoryExists } from './utils/helpers'

// 서버 시작 함수
const startServer = async (): Promise<void> => {
  try {
    // 필수 디렉토리 생성
    await ensureDirectoryExists(config.UPLOAD_DIR)
    logger.info(`Upload directory created/verified: ${config.UPLOAD_DIR}`)

    // 데이터베이스 연결 시도 (개발 환경에서는 실패해도 계속 진행)
    try {
      const { connectToDatabase, ensureIndexes } = await import('./config/database')
      await connectToDatabase()
      await ensureIndexes()
      logger.info('✅ Database connected and indexes created')
    } catch (error) {
      if (config.isDevelopment) {
        logger.warn('⚠️ Database connection failed, using in-memory storage for development:', error)
      } else {
        throw error
      }
    }
    
    // 서버 시작
    httpServer.listen(config.PORT, () => {
      logger.info(`🚀 Server is running on port ${config.PORT}`)
      logger.info(`📝 Environment: ${config.NODE_ENV}`)
      logger.info(`📁 Upload directory: ${config.UPLOAD_DIR}`)
      logger.info(`🔗 CORS origin: ${config.CORS_ORIGIN}`)
      
      if (config.isDevelopment) {
        logger.info(`🌐 Server URL: http://localhost:${config.PORT}`)
        logger.info(`🔍 Health check: http://localhost:${config.PORT}/health`)
      }
    })

    // 서버 에러 핸들링
    httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error
      }

      const bind = typeof config.PORT === 'string' 
        ? 'Pipe ' + config.PORT 
        : 'Port ' + config.PORT

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`)
          process.exit(1)
          break
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`)
          process.exit(1)
          break
        default:
          throw error
      }
    })

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// 서버 시작
startServer()

// 프로세스 정보 로깅
logger.info('Starting conRec Backend Server...', {
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  pid: process.pid,
  memory: process.memoryUsage()
})
