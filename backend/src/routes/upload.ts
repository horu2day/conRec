/**
 * 파일 업로드 라우터
 * - 오디오 파일 업로드 엔드포인트
 * - 파일 관리 API 엔드포인트
 * - 업로드 진행률 추적
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { uploadController } from '../controllers/uploadController';
import { uploadAudio, uploadMultipleAudio } from '../middleware/upload';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route   POST /api/upload/audio
 * @desc    단일 오디오 파일 업로드
 * @access  Public
 * @body    {roomId, participantId, participantName, duration}
 * @file    audio (multipart/form-data)
 */
router.post(
  '/audio',
  uploadAudio.single('audio'),
  uploadController.uploadAudioFile
);

/**
 * 배치 업로드 핸들러
 */
const batchUploadHandler: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roomId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: '업로드된 파일이 없습니다.'
      });
      return;
    }

    logger.info(`배치 업로드 시작: ${files.length}개 파일, 회의방 ${roomId}`);

    const uploadResults = [];
    const errors = [];

    // 각 파일을 순차적으로 처리
    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        if (!file) {
          errors.push({
            fileIndex: i,
            fileName: 'unknown',
            error: '파일이 존재하지 않습니다'
          });
          continue;
        }
        const participantData = JSON.parse(req.body.participants[i] || '{}');

        // 임시로 req 객체 수정하여 단일 업로드 함수 재사용
        const tempReq = {
          ...req,
          file,
          body: {
            ...req.body,
            participantId: participantData.participantId,
            participantName: participantData.participantName,
            duration: participantData.duration
          }
        };

        // 단일 업로드 로직 재사용하기 위한 임시 응답 객체
        const tempRes = {
          status: (code: number) => ({ json: (data: any) => ({ code, data }) }),
          headersSent: false
        };

        await uploadController.uploadAudioFile(tempReq as any, tempRes as any, next);
        
        uploadResults.push({
          fileIndex: i,
          fileName: file.originalname,
          status: 'success'
        });

      } catch (error) {
        logger.error(`배치 업로드 파일 ${i} 실패:`, error);
        errors.push({
          fileIndex: i,
          fileName: files[i]?.originalname || 'unknown',
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `배치 업로드 완료: ${uploadResults.length}개 성공, ${errors.length}개 실패`,
      data: {
        roomId,
        totalFiles: files.length,
        successCount: uploadResults.length,
        errorCount: errors.length,
        results: uploadResults,
        errors
      }
    });

  } catch (error) {
    logger.error('배치 업로드 처리 중 오류:', error);
    next(error);
  }
};

/**
 * @route   POST /api/upload/batch
 * @desc    다중 오디오 파일 업로드 (배치 처리)
 * @access  Public
 * @body    {roomId, participants[]}
 * @files   audios[] (multipart/form-data)
 */
router.post(
  '/batch',
  uploadMultipleAudio.array('audios', 10),
  batchUploadHandler
);

/**
 * @route   GET /api/upload/room/:roomId/files
 * @desc    회의방별 녹음 파일 목록 조회
 * @access  Public
 * @params  roomId
 */
router.get('/room/:roomId/files', uploadController.getRecordingFiles);

/**
 * @route   GET /api/upload/download/:fileId
 * @desc    녹음 파일 다운로드
 * @access  Public
 * @params  fileId
 */
router.get('/download/:fileId', uploadController.downloadFile);

/**
 * @route   DELETE /api/upload/:fileId
 * @desc    녹음 파일 삭제
 * @access  Public
 * @params  fileId
 */
router.delete('/:fileId', uploadController.deleteFile);

/**
 * @route   GET /api/upload/progress/:uploadId
 * @desc    업로드 진행률 조회
 * @access  Public
 * @params  uploadId
 */
router.get('/progress/:uploadId', uploadController.getUploadProgress);

/**
 * 헬스체크 핸들러
 */
const healthHandler: RequestHandler = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: '파일 업로드 서비스가 정상 작동 중입니다.',
    timestamp: new Date().toISOString(),
    service: 'upload',
    version: '1.0.0'
  });
};

/**
 * @route   GET /api/upload/health
 * @desc    업로드 서비스 상태 확인
 * @access  Public
 */
router.get('/health', healthHandler);

/**
 * 파일 검증 핸들러
 */
const validateHandler: RequestHandler = (req: Request, res: Response): void => {
  try {
    const { fileName, fileSize, mimeType } = req.body;

    if (!fileName || !fileSize || !mimeType) {
      res.status(400).json({
        success: false,
        message: '파일 정보가 불완전합니다.',
        required: ['fileName', 'fileSize', 'mimeType']
      });
      return;
    }

    // 파일 크기 검증 (100MB)
    const maxFileSize = 100 * 1024 * 1024;
    if (fileSize > maxFileSize) {
      res.status(400).json({
        success: false,
        message: `파일 크기가 너무 큽니다. 최대 ${maxFileSize / 1024 / 1024}MB까지 지원합니다.`,
        code: 'FILE_TOO_LARGE'
      });
      return;
    }

    // MIME 타입 검증
    const allowedMimeTypes = [
      'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/webm', 'audio/ogg', 'audio/mp3',
      'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a'
    ];

    if (!allowedMimeTypes.includes(mimeType)) {
      res.status(400).json({
        success: false,
        message: '지원하지 않는 파일 형식입니다.',
        code: 'INVALID_FILE_TYPE',
        supportedTypes: allowedMimeTypes
      });
      return;
    }

    // 파일 확장자 검증
    const allowedExtensions = ['.wav', '.webm', '.ogg', '.mp3', '.mp4', '.aac', '.m4a'];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      res.status(400).json({
        success: false,
        message: '지원하지 않는 파일 확장자입니다.',
        code: 'INVALID_FILE_EXTENSION',
        supportedExtensions: allowedExtensions
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: '파일 검증이 통과되었습니다.',
      data: {
        fileName,
        fileSize,
        mimeType,
        valid: true
      }
    });

  } catch (error) {
    logger.error('파일 검증 중 오류:', error);
    res.status(500).json({
      success: false,
      message: '파일 검증 중 서버 오류가 발생했습니다.'
    });
  }
};

/**
 * @route   POST /api/upload/validate
 * @desc    업로드 전 파일 검증
 * @access  Public
 * @body    {fileName, fileSize, mimeType}
 */
router.post('/validate', validateHandler);

export default router;
