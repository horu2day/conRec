/**
 * Multer 파일 업로드 미들웨어 설정
 * - 오디오 파일 업로드 최적화
 * - 파일 크기 및 형식 검증
 * - 임시 저장소 관리
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { logger } from '../utils/logger';

// 업로드 디렉토리 생성
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 임시 오디오 파일 저장 디렉토리
const audioTempDir = path.join(uploadDir, 'temp');
if (!fs.existsSync(audioTempDir)) {
  fs.mkdirSync(audioTempDir, { recursive: true });
}

/**
 * 파일 저장소 설정
 */
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, audioTempDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // 고유한 파일명 생성 (타임스탬프 + 원본 파일명)
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const filename = `audio_${uniqueSuffix}${ext}`;
    
    logger.info(`임시 파일 생성: ${filename}`);
    cb(null, filename);
  }
});

/**
 * 파일 필터링 - 오디오 파일만 허용
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 허용된 오디오 MIME 타입
  const allowedMimeTypes = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg',
    'audio/mp3',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/x-m4a'
  ];

  // 허용된 파일 확장자
  const allowedExtensions = ['.wav', '.webm', '.ogg', '.mp3', '.mp4', '.aac', '.m4a'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    logger.info(`파일 형식 검증 통과: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  } else {
    logger.warn(`지원하지 않는 파일 형식: ${file.originalname} (${file.mimetype})`);
    cb(new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedExtensions.join(', ')}`));
  }
};

/**
 * 기본 업로드 설정
 */
const uploadConfig: multer.Options = {
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB 제한 (10분 고품질 녹음 기준)
    files: 1, // 단일 파일만
    fieldSize: 1024 * 1024, // 1MB 필드 크기 제한
  }
};

/**
 * 대용량 파일 업로드 설정 (향후 확장용)
 */
const largeFileConfig: multer.Options = {
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB 제한
    files: 1,
    fieldSize: 1024 * 1024,
  }
};

/**
 * 기본 오디오 파일 업로드 미들웨어
 */
export const uploadAudio = multer(uploadConfig);

/**
 * 대용량 오디오 파일 업로드 미들웨어
 */
export const uploadLargeAudio = multer(largeFileConfig);

/**
 * 다중 오디오 파일 업로드 미들웨어 (배치 업로드용)
 */
export const uploadMultipleAudio = multer({
  ...uploadConfig,
  limits: {
    ...uploadConfig.limits,
    files: 10, // 최대 10개 파일
  }
});

/**
 * Multer 에러 핸들링 미들웨어
 */
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer 업로드 에러:', error);

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          message: '파일 크기가 너무 큽니다. 최대 100MB까지 업로드 가능합니다.',
          code: 'FILE_TOO_LARGE'
        });

      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: '파일 개수가 제한을 초과했습니다.',
          code: 'TOO_MANY_FILES'
        });

      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: '예상하지 못한 파일 필드입니다.',
          code: 'UNEXPECTED_FIELD'
        });

      case 'LIMIT_PART_COUNT':
        return res.status(400).json({
          success: false,
          message: '양식 부분이 너무 많습니다.',
          code: 'TOO_MANY_PARTS'
        });

      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({
          success: false,
          message: '필드 이름이 너무 깁니다.',
          code: 'FIELD_NAME_TOO_LONG'
        });

      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({
          success: false,
          message: '필드 값이 너무 깁니다.',
          code: 'FIELD_VALUE_TOO_LONG'
        });

      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({
          success: false,
          message: '필드 개수가 너무 많습니다.',
          code: 'TOO_MANY_FIELDS'
        });

      default:
        return res.status(400).json({
          success: false,
          message: '파일 업로드 중 오류가 발생했습니다.',
          code: 'UPLOAD_ERROR'
        });
    }
  }

  // 파일 필터 에러 (지원하지 않는 파일 형식)
  if (error.message.includes('지원하지 않는 파일 형식')) {
    return res.status(400).json({
      success: false,
      message: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  // 기타 에러
  logger.error('업로드 에러:', error);
  return res.status(500).json({
    success: false,
    message: '파일 업로드 처리 중 서버 오류가 발생했습니다.',
    code: 'INTERNAL_ERROR'
  });
};

/**
 * 임시 파일 정리 유틸리티
 */
export const cleanupTempFiles = async (): Promise<void> => {
  try {
    const files = await fs.promises.readdir(audioTempDir);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1시간

    for (const file of files) {
      const filePath = path.join(audioTempDir, file);
      const stats = await fs.promises.stat(filePath);
      
      // 1시간 이상 된 임시 파일 삭제
      if (now - stats.mtime.getTime() > oneHour) {
        await fs.promises.unlink(filePath);
        logger.info(`임시 파일 정리: ${file}`);
      }
    }
  } catch (error) {
    logger.error('임시 파일 정리 실패:', error);
  }
};

// 30분마다 임시 파일 정리
setInterval(cleanupTempFiles, 30 * 60 * 1000);

export default {
  uploadAudio,
  uploadLargeAudio,
  uploadMultipleAudio,
  handleUploadError,
  cleanupTempFiles
};
