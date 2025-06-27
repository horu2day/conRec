import { config } from '@/config'

// 로그 레벨 정의
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// 로그 레벨 매핑
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  'error': LogLevel.ERROR,
  'warn': LogLevel.WARN,
  'info': LogLevel.INFO,
  'debug': LogLevel.DEBUG
}

class Logger {
  private currentLevel: LogLevel

  constructor() {
    this.currentLevel = LOG_LEVEL_MAP[config.LOG_LEVEL] ?? LogLevel.INFO
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.currentLevel
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta, null, 2)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return '\x1b[31m' // Red
      case LogLevel.WARN:
        return '\x1b[33m' // Yellow
      case LogLevel.INFO:
        return '\x1b[36m' // Cyan
      case LogLevel.DEBUG:
        return '\x1b[90m' // Gray
      default:
        return '\x1b[0m' // Reset
    }
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return

    const formattedMessage = this.formatMessage(levelName, message, meta)
    const color = this.getColor(level)
    const resetColor = '\x1b[0m'

    if (config.isDevelopment) {
      console.log(`${color}${formattedMessage}${resetColor}`)
    } else {
      console.log(formattedMessage)
    }
  }

  error(message: string, meta?: any): void {
    this.log(LogLevel.ERROR, 'error', message, meta)
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, 'warn', message, meta)
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, 'info', message, meta)
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, 'debug', message, meta)
  }

  // HTTP 요청 로깅
  http(method: string, url: string, statusCode: number, responseTime: number): void {
    const message = `${method} ${url} ${statusCode} - ${responseTime}ms`
    
    if (statusCode >= 500) {
      this.error(message)
    } else if (statusCode >= 400) {
      this.warn(message)
    } else {
      this.info(message)
    }
  }

  // 소켓 이벤트 로깅
  socket(event: string, socketId: string, data?: any): void {
    this.debug(`Socket [${socketId}] ${event}`, data)
  }

  // 파일 작업 로깅
  file(operation: string, fileName: string, details?: any): void {
    this.info(`File ${operation}: ${fileName}`, details)
  }

  // 데이터베이스 작업 로깅
  db(operation: string, collection: string, details?: any): void {
    this.debug(`DB ${operation} on ${collection}`, details)
  }

  // 레벨 변경
  setLevel(level: string): void {
    const newLevel = LOG_LEVEL_MAP[level.toLowerCase()]
    if (newLevel !== undefined) {
      this.currentLevel = newLevel
      this.info(`Log level changed to ${level}`)
    } else {
      this.warn(`Invalid log level: ${level}`)
    }
  }
}

// 싱글톤 인스턴스
export const logger = new Logger()

// 에러 객체 로깅을 위한 헬퍼
export const logError = (error: Error, context?: string): void => {
  const message = context ? `${context}: ${error.message}` : error.message
  logger.error(message, {
    name: error.name,
    stack: error.stack,
    ...(error as any).details
  })
}

// 성능 측정을 위한 헬퍼
export const createTimer = (label: string) => {
  const start = Date.now()
  
  return {
    end: () => {
      const duration = Date.now() - start
      logger.debug(`Timer [${label}]: ${duration}ms`)
      return duration
    }
  }
}

// 요청 ID 생성 (추적용)
let requestIdCounter = 0
export const generateRequestId = (): string => {
  requestIdCounter = (requestIdCounter + 1) % 1000000
  return `req_${Date.now()}_${requestIdCounter.toString().padStart(6, '0')}`
}
