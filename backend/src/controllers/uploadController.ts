/**
 * 파일 업로드 컨트롤러
 * - 회의 녹음 파일 업로드 처리
 * - MongoDB GridFS를 통한 대용량 파일 저장
 * - 업로드 진행률 및 메타데이터 관리
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

export class UploadController {
  private gridFSBucket: GridFSBucket;

  constructor() {
    // MongoDB GridFS 초기화
    this.gridFSBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'recordings'
    });
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

      // 회의방 존재 확인
      const room = await Room.findById(roomId);
      if (!room) {
        res.status(404).json({
          success: false,
          message: '회의방을 찾을 수 없습니다.'
        });
        return;
      }

      const file = req.file;
      const fileName = `${roomId}_${participantId}_${Date.now()}${path.extname(file.originalname)}`;
      
      // GridFS 업로드 스트림 생성
      const uploadStream = this.gridFSBucket.openUploadStream(fileName, {
        metadata: {
          roomId,
          participantId,
          participantName,
          duration: parseInt(duration) || 0,
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
            roomId,
            participantId,
            participantName,
            fileName,
            filePath: uploadStream.id.toString(),
            fileSize: file.size,
            duration: parseInt(duration) || 0,
            mimeType: file.mimetype,
            uploadedAt: new Date(),
            gridFSId: uploadStream.id
          });

          await recordingFile.save();

          // 임시 파일 삭제
          fs.unlinkSync(file.path);

          logger.info(`파일 업로드 완료: ${fileName} (${file.size} bytes)`);

          res.status(201).json({
            success: true,
            message: '파일이 성공적으로 업로드되었습니다.',
            data: {
              fileId: recordingFile._id,
              fileName,
              fileSize: file.size,
              duration: parseInt(duration) || 0,
              uploadedAt: recordingFile.uploadedAt
            }
          });

        } catch (error) {
          logger.error('파일 메타데이터 저장 실패:', error);
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
          message: '파일 업로드에 실패했습니다.',
          error: error.message
        });
      });

    } catch (error) {
      logger.error('파일 업로드 처리 중 오류:', error);
      next(error);
    }
  };

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

      const downloadStream = this.gridFSBucket.openDownloadStream(recordingFile.gridFSId);
      
      // 응답 헤더 설정
      res.set({
        'Content-Type': recordingFile.mimeType,
        'Content-Disposition': `attachment; filename="${recordingFile.fileName}"`,
        'Content-Length': recordingFile.fileSize.toString()
      });

      downloadStream.pipe(res);

      downloadStream.on('error', (error) => {
        logger.error('파일 다운로드 실패:', error);
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: '파일 다운로드에 실패했습니다.'
          });
        }
      });

    } catch (error) {
      logger.error('파일 다운로드 처리 중 오류:', error);
      next(error);
    }
  };

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

      // GridFS에서 파일 삭제
      await this.gridFSBucket.delete(recordingFile.gridFSId);

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
      // 실제 구현에서는 Redis나 임시 저장소를 사용하여 진행률 추적
      const { uploadId } = req.params;
      
      res.status(200).json({
        success: true,
        data: {
          uploadId,
          progress: 100, // 현재는 단순 구현
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
