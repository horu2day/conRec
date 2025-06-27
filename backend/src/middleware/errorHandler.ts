import { Request, Response, NextFunction } from 'express'
import { AppError } from '@/types'
import { logger } from '@/utils/logger'
import { config } from '@/config'

// 에러 핸들링 미들웨어
export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 에러 로깅
  logger.error(`Error in ${req.method} ${req.path}`, {
    error: error.message,
    stack: error.stack,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  // 기본값 설정
  let statusCode = error.statusCode || 500
  let message = error.message || 'Internal Server Error'
  let code = error.code

  // 몽고DB 에러 처리
  if (error.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation Error'
    code = 'VALIDATION_ERROR'
  } else if (error.name === 'CastError') {
    statusCode = 400
    message = 'Invalid ID format'
    code = 'INVALID_ID'
  } else if (error.name === 'MongoServerError' && (error as any).code === 11000) {
    statusCode = 409
    message = 'Duplicate entry'
    code = 'DUPLICATE_ENTRY'
  }

  // JWT 에러 처리
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
    code = 'INVALID_TOKEN'
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token expired'
    code = 'TOKEN_EXPIRED'
  }

  // Multer 에러 처리 (파일 업로드)
  if (error.name === 'MulterError') {
    statusCode = 400
    if ((error as any).code === 'LIMIT_FILE_SIZE') {
      message = 'File too large'
      code = 'FILE_TOO_LARGE'
    } else if ((error as any).code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files'
      code = 'TOO_MANY_FILES'
    } else {
      message = 'File upload error'
      code = 'FILE_UPLOAD_ERROR'
    }
  }

  // 응답 구성
  const response: any = {
    success: false,
    error: message,
    code
  }

  // 개발 환경에서는 스택 트레이스 포함
  if (config.isDevelopment) {
    response.stack = error.stack
  }

  res.status(statusCode).json(response)
}

// 404 에러 핸들러
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new Error(`Not found - ${req.originalUrl}`) as AppError
  error.statusCode = 404
  error.code = 'NOT_FOUND'
  error.isOperational = true
  
  next(error)
}

// 비동기 에러 캐처
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// 에러 생성 헬퍼
export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string
): AppError => {
  const error = new Error(message) as AppError
  error.statusCode = statusCode
  error.code = code
  error.isOperational = true
  return error
}

// 운영 에러 여부 확인
export const isOperationalError = (error: Error): boolean => {
  return (error as AppError).isOperational === true
}

// 알려진 에러 코드들
export const ERROR_CODES = {
  // 인증 관련
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // 검증 관련
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_ID: 'INVALID_ID',

  // 리소스 관련
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // 파일 관련
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',

  // 회의 관련
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ENDED: 'ROOM_ENDED',
  NOT_HOST: 'NOT_HOST',
  ALREADY_RECORDING: 'ALREADY_RECORDING',
  NOT_RECORDING: 'NOT_RECORDING',

  // 서버 관련
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
