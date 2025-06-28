/**
 * 파일 업로드 컨트롤러
 * - 회의 녹음 파일 업로드 처리
 * - MongoDB GridFS를 통한 대용량 파일 저장
 * - 업로드 진행률 및 메타데이터 관리
 * - 개발 환경에서 MongoDB 없이도 동작 지원
 */

import { Request, Response, NextFunction } from 'express';
import { GridFSBucket, ObjectId } from 'mongodb';
import { MulterError } from 'multer';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { RecordingFile } from '../models/RecordingFile';
import { Room } from '../models/Room';
import { logger } from '../utils/logger';
import { config } from '@/config';

export class UploadController {
  private gridFSBucket: GridFSBucket | null = null;

  constructor() {
    // GridFS는 지연 초기화로 처리
    this.initializeGridFS();
  }

  /**
   * GridFS 지연 초기화
   */
  private async initializeGridFS(): Promise<void> {
    try {
      // MongoDB 연결 확인
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        this.gridFSBucket = new GridFSBucket(mongoose.connection.db, {
          bucketName: 'recordings'
        });
        logger.info('✅ GridFS initialized successfully');
      } else {
        logger.warn('⚠️ MongoDB not connected, GridFS will be initialized later');
      }
    } catch (error) {
      logger.error('❌ Failed to initialize GridFS:', error);
    }
  }

  /**
   * GridFS 인스턴스 확인 및 반환
   */
  private async getGridFSBucket(): Promise<GridFSBucket | null> {
    if (!this.gridFSBucket && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await this.initializeGridFS();
    }
    return this.gridFSBucket;
  }

  /**
   * 단일 오디오 파일 업로드
   * POST /api/upload/audio
   */
  public uploadAudioFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roomId, participantId, participantName, duration } = req.body;
      
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: '업로드된 파일이 없습니다.'
        });
        return;
      }

      if (!roomId || !participantId) {
        res.status(400).json({
          success: false,
          message: '회의방 ID와 참가자 ID가 필요합니다.'
        });
        return;
      }

      const file = req.file;
      const fileName = `${roomId}_${participantId}_${Date.now()}${path.extname(file.originalname)}`;
      
      // GridFS 사용 가능 여부 확인
      const gridFSBucket = await this.getGridFSBucket();
      
      if (gridFSBucket) {
        // MongoDB GridFS로 업로드
        await this.uploadToGridFS(file, fileName, {
          roomId,
          participantId,
          participantName,
          duration: parseInt(duration) || 0
        }, res);
      } else {
        // 파일 시스템으로 폴백
        await this.uploadToFileSystem(file, fileName, {
          roomId,
          participantId,
          participantName,
          duration: parseInt(duration) || 0
        }, res);
      }

    } catch (error) {
      logger.error('파일 업로드 처리 중 오류:', error);
      
      // 임시 파일 정리
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      next(error);
    }
  };

  /**
   * GridFS로 파일 업로드
   */
  private async uploadToGridFS(
    file: Express.Multer.File,
    fileName: string,
    metadata: any,
    res: Response
  ): Promise<void> {
    const gridFSBucket = await this.getGridFSBucket();
    if (!gridFSBucket) {
      throw new Error('GridFS not available');
    }

    // GridFS 업로드 스트림 생성
    const uploadStream = gridFSBucket.openUploadStream(fileName, {
      metadata: {
        ...metadata,
        originalName: file.originalname,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
        fileSize: file.size
      }
    });

    // 임시 파일을 GridFS로 스트림
    const readStream = fs.createReadStream(file.path);
    readStream.pipe(uploadStream);

    uploadStream.on('finish', async () => {
      try {
        // RecordingFile 모델에 메타데이터 저장
        const recordingFile = new RecordingFile({
          roomId: metadata.roomId,
          participantId: metadata.participantId,
          participantName: metadata.participantName,
          fileName,
          filePath: uploadStream.id.toString(),
          fileSize: file.size,
          duration: metadata.duration,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
          gridFSId: uploadStream.id
        });

        await recordingFile.save();

        // 임시 파일 삭제
        fs.unlinkSync(file.path);

        logger.info(`GridFS 파일 업로드 완료: ${fileName} (${file.size} bytes)`);

        res.status(201).json({
          success: true,
          message: '파일이 성공적으로 업로드되었습니다.',
          data: {
            fileId: recordingFile._id,
            fileName,
            fileSize: file.size,
            duration: metadata.duration,
            uploadedAt: recordingFile.uploadedAt,
            storageType: 'gridfs'
          }
        });

      } catch (error) {
        logger.error('GridFS 파일 메타데이터 저장 실패:', error);
        res.status(500).json({
          success: false,
          message: '파일 메타데이터 저장에 실패했습니다.'
        });
      }
    });

    uploadStream.on('error', (error) => {
      logger.error('GridFS 업로드 실패:', error);
      
      // 임시 파일 정리
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      res.status(500).json({
        success: false,
        message: 'GridFS 파일 업로드에 실패했습니다.',
        error: error.message
      });
    });
  }

  /**
   * 파일 시스템으로 파일 업로드 (폴백)
   */
  private async uploadToFileSystem(
    file: Express.Multer.File,
    fileName: string,
    metadata: any,
    res: Response
  ): Promise<void> {
    try {
      // 업로드 디렉토리 확보
      const uploadDir = path.join(config.UPLOAD_DIR, 'recordings');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 파일을 최종 위치로 이동
      const finalPath = path.join(uploadDir, fileName);
      fs.renameSync(file.path, finalPath);

      // RecordingFile 모델에 메타데이터 저장 (GridFS 없이)
      const recordingFile = new RecordingFile({
        roomId: metadata.roomId,
        participantId: metadata.participantId,
        participantName: metadata.participantName,
        fileName,
        filePath: finalPath,
        fileSize: file.size,
        duration: metadata.duration,
        mimeType: file.mimetype,
        uploadedAt: new Date()
        // gridFSId는 설정하지 않음
      });

      await recordingFile.save();

      logger.info(`파일 시스템 업로드 완료: ${fileName} (${file.size} bytes)`);

      res.status(201).json({
        success: true,
        message: '파일이 성공적으로 업로드되었습니다.',
        data: {
          fileId: recordingFile._id,
          fileName,
          fileSize: file.size,
          duration: metadata.duration,
          uploadedAt: recordingFile.uploadedAt,
          storageType: 'filesystem'
        }
      });

    } catch (error) {
      logger.error('파일 시스템 업로드 실패:', error);
      
      // 임시 파일 정리
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      res.status(500).json({
        success: false,
        message: '파일 업로드에 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 회의 녹음 파일 목록 조회
   * GET /api/upload/room/:roomId/files
   */
  public getRecordingFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roomId } = req.params;

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: '회의방 ID가 필요합니다.'
        });
        return;
      }

      const files = await RecordingFile.find({ roomId })
        .sort({ uploadedAt: -1 })
        .select('-gridFSId -filePath');

      res.status(200).json({
        success: true,
        message: '녹음 파일 목록을 조회했습니다.',
        data: {
          roomId,
          totalFiles: files.length,
          files: files.map(file => ({
            fileId: file._id,
            participantId: file.participantId,
            participantName: file.participantName,
            fileName: file.fileName,
            fileSize: file.fileSize,
            duration: file.duration,
            mimeType: file.mimeType,
            uploadedAt: file.uploadedAt
          }))
        }
      });

    } catch (error) {
      logger.error('녹음 파일 목록 조회 실패:', error);
      next(error);
    }
  };

  /**
   * 녹음 파일 다운로드
   * GET /api/upload/download/:fileId
   */
  public downloadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        res.status(400).json({
          success: false,
          message: '파일 ID가 필요합니다.'
        });
        return;
      }

      const recordingFile = await RecordingFile.findById(fileId);
      if (!recordingFile) {
        res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다.'
        });
        return;
      }

      // GridFS 파일인지 확인
      if (recordingFile.gridFSId && this.gridFSBucket) {
        await this.downloadFromGridFS(recordingFile, res);
      } else {
        await this.downloadFromFileSystem(recordingFile, res);
      }

    } catch (error) {
      logger.error('파일 다운로드 처리 중 오류:', error);
      next(error);
    }
  };

  /**
   * GridFS에서 파일 다운로드
   */
  private async downloadFromGridFS(recordingFile: any, res: Response): Promise<void> {
    const gridFSBucket = await this.getGridFSBucket();
    if (!gridFSBucket) {
      res.status(500).json({
        success: false,
        message: 'GridFS를 사용할 수 없습니다.'
      });
      return;
    }

    const downloadStream = gridFSBucket.openDownloadStream(recordingFile.gridFSId);
    
    // 응답 헤더 설정
    res.set({
      'Content-Type': recordingFile.mimeType,
      'Content-Disposition': `attachment; filename="${recordingFile.fileName}"`,
      'Content-Length': recordingFile.fileSize.toString()
    });

    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      logger.error('GridFS 파일 다운로드 실패:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '파일 다운로드에 실패했습니다.'
        });
      }
    });
  }

  /**
   * 파일 시스템에서 파일 다운로드
   */
  private async downloadFromFileSystem(recordingFile: any, res: Response): Promise<void> {
    try {
      if (!fs.existsSync(recordingFile.filePath)) {
        res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다.'
        });
        return;
      }

      // 응답 헤더 설정
      res.set({
        'Content-Type': recordingFile.mimeType,
        'Content-Disposition': `attachment; filename="${recordingFile.fileName}"`,
        'Content-Length': recordingFile.fileSize.toString()
      });

      // 파일 스트림 생성
      const fileStream = fs.createReadStream(recordingFile.filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        logger.error('파일 시스템 다운로드 실패:', error);
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: '파일 다운로드에 실패했습니다.'
          });
        }
      });

    } catch (error) {
      logger.error('파일 시스템 다운로드 처리 중 오류:', error);
      res.status(500).json({
        success: false,
        message: '파일 다운로드에 실패했습니다.'
      });
    }
  }

  /**
   * 파일 삭제
   * DELETE /api/upload/:fileId
   */
  public deleteFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fileId } = req.params;

      if (!fileId) {
        res.status(400).json({
          success: false,
          message: '파일 ID가 필요합니다.'
        });
        return;
      }

      const recordingFile = await RecordingFile.findById(fileId);
      if (!recordingFile) {
        res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다.'
        });
        return;
      }

      // GridFS 파일인지 확인하여 삭제
      if (recordingFile.gridFSId && this.gridFSBucket) {
        await this.gridFSBucket.delete(recordingFile.gridFSId);
      } else if (fs.existsSync(recordingFile.filePath)) {
        fs.unlinkSync(recordingFile.filePath);
      }

      // 메타데이터 삭제
      await RecordingFile.findByIdAndDelete(fileId);

      logger.info(`파일 삭제 완료: ${recordingFile.fileName}`);

      res.status(200).json({
        success: true,
        message: '파일이 성공적으로 삭제되었습니다.',
        data: {
          fileId,
          fileName: recordingFile.fileName
        }
      });

    } catch (error) {
      logger.error('파일 삭제 처리 중 오류:', error);
      next(error);
    }
  };

  /**
   * 업로드 진행률 체크
   * GET /api/upload/progress/:uploadId
   */
  public getUploadProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uploadId } = req.params;
      
      res.status(200).json({
        success: true,
        data: {
          uploadId,
          progress: 100,
          status: 'completed'
        }
      });

    } catch (error) {
      logger.error('업로드 진행률 조회 실패:', error);
      next(error);
    }
  };
}

export const uploadController = new UploadController();
