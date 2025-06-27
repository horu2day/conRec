import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { config } from '@/config'
import { logger } from '@/utils/logger'
import { 
  errorHandler, 
  notFoundHandler 
} from '@/middleware/errorHandler'
import { 
  addRequestInfo, 
  requestLogger, 
  detailedLogger, 
  slowRequestWarning 
} from '@/middleware/logger'

// Express 앱 생성
const app = express()

// HTTP 서버 생성
const httpServer = createServer(app)

// Socket.IO 서버 생성
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
})

// 보안 미들웨어
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}))

// CORS 설정
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}))

// 요청 파싱 미들웨어
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 로깅 미들웨어
app.use(addRequestInfo)
app.use(requestLogger)

// 개발 환경에서만 상세 로깅
if (config.isDevelopment) {
  app.use(detailedLogger)
}

// 느린 요청 경고
app.use(slowRequestWarning(3000)) // 3초 이상

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV
  })
})

// API 라우트
app.use('/api', (req, res, next) => {
  logger.debug(`API request: ${req.method} ${req.path}`)
  next()
})

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: 'conRec Backend API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/docs'
  })
})

// API 라우트들
import uploadRoutes from './routes/upload'

app.use('/api/upload', uploadRoutes)
// app.use('/api/rooms', roomRoutes) // TODO: 회의방 라우트 추가

// 404 핸들러
app.use(notFoundHandler)

// 에러 핸들러
app.use(errorHandler)

// Socket.IO 서비스 초기화 (기존 io 객체 대체)
// import { SocketService } from '@/services/socketService'
// const socketService = new SocketService(httpServer)

// 기본 Socket.IO 이벤트 핸들러
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`)
  
  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`)
  })
  
  socket.on('error', (error) => {
    logger.error(`Socket error [${socket.id}]:`, error)
  })

  // TODO: 나중에 SocketService 로 대체
})

// graceful shutdown 처리
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`)
  
  httpServer.close(() => {
    logger.info('HTTP server closed')
    
    // 추가 정리 작업
    io.close(() => {
      logger.info('Socket.IO server closed')
      process.exit(0)
    })
  })
  
  // 강제 종료 (30초 후)
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down')
    process.exit(1)
  }, 30000)
}

// 시그널 핸들러 등록
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// 예상치 못한 에러 처리
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  gracefulShutdown('UNCAUGHT_EXCEPTION')
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason })
  gracefulShutdown('UNHANDLED_REJECTION')
})

export { app, httpServer, io }
