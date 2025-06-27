import dotenv from 'dotenv'
import { ProcessEnv } from '@/types'

// 환경 변수 로드
dotenv.config()

// 환경 변수 검증 및 타입 안전성 보장
class Config {
  public readonly NODE_ENV: ProcessEnv['NODE_ENV']
  public readonly PORT: number
  public readonly MONGODB_URI: string
  public readonly JWT_SECRET: string
  public readonly JWT_EXPIRES_IN: string
  public readonly CORS_ORIGIN: string
  public readonly UPLOAD_DIR: string
  public readonly MAX_FILE_SIZE: number
  public readonly ALLOWED_FILE_TYPES: string[]
  public readonly OPENAI_API_KEY: string
  public readonly LOG_LEVEL: string
  public readonly RATE_LIMIT_WINDOW_MS: number
  public readonly RATE_LIMIT_MAX_REQUESTS: number
  public readonly MAX_PARTICIPANTS_PER_ROOM: number
  public readonly MAX_RECORDING_DURATION_MS: number

  constructor() {
    // 필수 환경 변수 검증
    this.validateRequiredEnvVars()

    // 환경 변수 설정
    this.NODE_ENV = (process.env.NODE_ENV as ProcessEnv['NODE_ENV']) || 'development'
    this.PORT = parseInt(process.env.PORT || '3000', 10)
    this.MONGODB_URI = process.env.MONGODB_URI!
    this.JWT_SECRET = process.env.JWT_SECRET!
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'
    this.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
    this.UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
    this.MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800', 10) // 50MB
    this.ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'audio/wav,audio/webm,audio/mp3,audio/ogg').split(',')
    this.OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
    this.LOG_LEVEL = process.env.LOG_LEVEL || 'info'
    this.RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) // 15분
    this.RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
    this.MAX_PARTICIPANTS_PER_ROOM = parseInt(process.env.MAX_PARTICIPANTS_PER_ROOM || '50', 10)
    this.MAX_RECORDING_DURATION_MS = parseInt(process.env.MAX_RECORDING_DURATION_MS || '7200000', 10) // 2시간
  }

  private validateRequiredEnvVars(): void {
    const requiredVars = [
      'MONGODB_URI',
      'JWT_SECRET'
    ]

    const missing = requiredVars.filter(varName => !process.env[varName])

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }

  // 개발 환경 여부
  public get isDevelopment(): boolean {
    return this.NODE_ENV === 'development'
  }

  // 프로덕션 환경 여부
  public get isProduction(): boolean {
    return this.NODE_ENV === 'production'
  }

  // 테스트 환경 여부
  public get isTest(): boolean {
    return this.NODE_ENV === 'test'
  }
}

// 싱글톤 인스턴스
export const config = new Config()

// 타입 안전한 환경 변수 접근
export const getEnvVar = (key: keyof ProcessEnv, defaultValue?: string): string => {
  const value = process.env[key]
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is not defined`)
  }
  return value || defaultValue!
}

// 환경 변수를 숫자로 변환
export const getEnvNumber = (key: keyof ProcessEnv, defaultValue?: number): number => {
  const value = process.env[key]
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is not defined`)
  }
  const parsed = parseInt(value || defaultValue!.toString(), 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} is not a valid number`)
  }
  return parsed
}

// 환경 변수를 불린으로 변환
export const getEnvBoolean = (key: keyof ProcessEnv, defaultValue?: boolean): boolean => {
  const value = process.env[key]
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is not defined`)
  }
  return (value || defaultValue!.toString()).toLowerCase() === 'true'
}
