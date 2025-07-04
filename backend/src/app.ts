import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'
import { config } from './config/index'
import { logger } from './utils/logger'
import { 
  errorHandler, 
  notFoundHandler 
} from './middleware/errorHandler'
import { 
  addRequestInfo, 
  requestLogger, 
  detailedLogger, 
  slowRequestWarning 
} from './middleware/logger'

// Express 앱 생성
const app = express()

// HTTP 서버 생성
const httpServer = createServer(app)

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
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV
  })
})

// API 라우트
app.use('/api', (req, _res, next) => {
  logger.debug(`API request: ${req.method} ${req.path}`)
  next()
})

// 기본 라우트
app.get('/', (_req, res) => {
  res.json({
    message: 'conRec Backend API',
    version: '1.0.0',
    status: 'running',
    docs: '/api/docs',
    socketio: 'enabled',
    upload: '/api/upload'
  })
})

// API 라우트들
import uploadRoutes from './routes/upload'
import roomRoutes from './routes/rooms'

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import roomRoutes from './routes/rooms';
import uploadRoutes from './routes/upload';

const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));
app.use(helmet());
app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);

// Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

export { app, httpServer };

// 404 핸들러
app.use(notFoundHandler)

// 에러 핸들러
app.use(errorHandler)

// Socket.IO 서비스 초기화
import { SocketService } from './services/socketService'
const socketService = new SocketService(httpServer)

logger.info('Socket.IO service initialized')

// graceful shutdown 처리
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`)
  
  httpServer.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
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

export { app, httpServer, socketService }
