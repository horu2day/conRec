import { Request, Response, NextFunction } from 'express'
import morgan from 'morgan'
import { logger, generateRequestId } from '@/utils/logger'
import { config } from '@/config'

// Request 인터페이스 확장
declare global {
  namespace Express {
    interface Request {
      requestId: string
      startTime: number
    }
  }
}

// 요청 ID 및 시작 시간 추가 미들웨어
export const addRequestInfo = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = generateRequestId()
  req.startTime = Date.now()
  
  // 응답 헤더에 요청 ID 추가
  res.setHeader('X-Request-ID', req.requestId)
  
  next()
}

// 개발 환경용 상세 로그 포맷
const createDevFormat = (): string => {
  return [
    '[:date[iso]]',
    ':method',
    ':url',
    ':status',
    ':res[content-length]',
    '-',
    ':response-time ms',
    'from :remote-addr',
    '":user-agent"'
  ].join(' ')
}

// 프로덕션 환경용 간단한 로그 포맷
const createProdFormat = (): string => {
  return [
    ':remote-addr',
    ':method',
    ':url',
    ':status',
    ':response-time ms'
  ].join(' ')
}

// 로그 스킵 조건 (정적 파일, 헬스체크 등)
const shouldSkipLog = (req: Request, res: Response): boolean => {
  // 헬스체크 엔드포인트 스킵
  if (req.path === '/health' || req.path === '/ping') {
    return true
  }
  
  // 정적 파일 스킵 (개발 환경에서는 로그)
  if (!config.isDevelopment && req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    return true
  }
  
  // 성공적인 OPTIONS 요청 스킵
  if (req.method === 'OPTIONS' && res.statusCode < 400) {
    return true
  }
  
  return false
}

// Morgan 설정
const morganFormat = config.isDevelopment ? createDevFormat() : createProdFormat()

export const requestLogger = morgan(morganFormat, {
  skip: shouldSkipLog,
  stream: {
    write: (message: string) => {
      // Morgan의 메시지에서 줄바꿈 제거
      const cleanMessage = message.trim()
      logger.info(cleanMessage)
    }
  }
})

// 요청/응답 상세 로거 (디버그용)
export const detailedLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (!config.isDevelopment) {
    return next()
  }

  // 요청 정보 로깅
  logger.debug(`Request [${req.requestId}]`, {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
    query: req.query,
    params: req.params,
    ip: req.ip
  })

  // 응답 완료 시 로깅
  const originalSend = res.send
  res.send = function(body: any) {
    const responseTime = Date.now() - req.startTime
    
    logger.debug(`Response [${req.requestId}]`, {
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      headers: res.getHeaders(),
      body: typeof body === 'string' ? body.substring(0, 1000) : '[Non-string body]'
    })
    
    return originalSend.call(this, body)
  }

  next()
}

// 에러 로그 미들웨어
export const errorLogger = (error: Error, req: Request, _res: Response, next: NextFunction): void => {
  logger.error(`Error [${req.requestId}]: ${error.message}`, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  })

  next(error)
}

// 느린 요청 경고 미들웨어
export const slowRequestWarning = (threshold: number = 5000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send
    
    res.send = function(body: any) {
      const responseTime = Date.now() - req.startTime
      
      if (responseTime > threshold) {
        logger.warn(`Slow request detected [${req.requestId}]`, {
          method: req.method,
          url: req.originalUrl,
          responseTime: `${responseTime}ms`,
          threshold: `${threshold}ms`
        })
      }
      
      return originalSend.call(this, body)
    }
    
    next()
  }
}

// Socket.IO 연결 로거
export const socketLogger = {
  connection: (socketId: string, userAgent?: string) => {
    logger.info(`Socket connected: ${socketId}`, { userAgent })
  },
  
  disconnect: (socketId: string, reason: string) => {
    logger.info(`Socket disconnected: ${socketId}`, { reason })
  },
  
  event: (socketId: string, event: string, data?: any) => {
    logger.debug(`Socket event [${socketId}]: ${event}`, data)
  },
  
  error: (socketId: string, error: Error) => {
    logger.error(`Socket error [${socketId}]: ${error.message}`, {
      error: error.stack
    })
  },
  
  roomJoin: (socketId: string, roomId: string, userName: string) => {
    logger.info(`Socket [${socketId}] joined room [${roomId}] as ${userName}`)
  },
  
  roomLeave: (socketId: string, roomId: string) => {
    logger.info(`Socket [${socketId}] left room [${roomId}]`)
  }
}
