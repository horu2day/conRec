import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'
import { AppError } from '@/types'

/**
 * 고유한 ID 생성
 */
export const generateId = (): string => {
  return uuidv4()
}

/**
 * 짧은 고유 ID 생성 (회의방 ID용)
 */
export const generateShortId = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 안전한 파일명 생성
 */
export const generateSafeFileName = (originalName: string, userId: string): string => {
  const ext = path.extname(originalName)
  const timestamp = Date.now()
  const shortId = generateShortId(6)
  return `${userId}_${timestamp}_${shortId}${ext}`
}

/**
 * 파일 크기를 읽기 쉬운 형태로 변환
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]!
}

/**
 * 시간을 읽기 쉬운 형태로 변환
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

/**
 * 디렉토리가 존재하지 않으면 생성
 */
export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

/**
 * 파일 존재 여부 확인
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 파일 삭제 (에러 무시)
 */
export const deleteFileIfExists = async (filePath: string): Promise<void> => {
  try {
    if (await fileExists(filePath)) {
      await fs.unlink(filePath)
    }
  } catch (error) {
    console.warn(`Failed to delete file ${filePath}:`, error)
  }
}

/**
 * MIME 타입에서 파일 확장자 추출
 */
export const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: Record<string, string> = {
    'audio/wav': '.wav',
    'audio/webm': '.webm',
    'audio/mp3': '.mp3',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/m4a': '.m4a'
  }
  
  return mimeToExt[mimeType] || '.audio'
}

/**
 * 파일 타입 검증
 */
export const isValidAudioFile = (mimeType: string, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(mimeType)
}

/**
 * 에러 객체 생성
 */
export const createError = (message: string, statusCode: number = 500, code?: string): AppError => {
  const error = new Error(message) as AppError
  error.statusCode = statusCode
  error.code = code
  error.isOperational = true
  return error
}

/**
 * 비동기 함수 래퍼 (에러 핸들링)
 */
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * 딜레이 함수
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 객체의 undefined 값 제거
 */
export const removeUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: Partial<T> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value
    }
  }
  
  return result
}

/**
 * 배열을 청크 단위로 분할
 */
export const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = []
  
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  
  return chunks
}

/**
 * 랜덤 지연 시간 생성 (지터)
 */
export const randomDelay = (min: number, max: number): Promise<void> => {
  const delayMs = Math.floor(Math.random() * (max - min + 1)) + min
  return delay(delayMs)
}

/**
 * 객체를 JSON으로 안전하게 변환
 */
export const safeJsonStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj)
  } catch (error) {
    return '[Circular Reference or Invalid JSON]'
  }
}

/**
 * 문자열을 안전하게 JSON으로 파싱
 */
export const safeJsonParse = <T = any>(str: string, defaultValue: T): T => {
  try {
    return JSON.parse(str)
  } catch {
    return defaultValue
  }
}
