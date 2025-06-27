/**
 * 파일 업로드 서비스
 * - 오디오 파일 업로드 API 호출
 * - 업로드 진행률 추적
 * - 파일 검증 및 에러 처리
 */

import axios, { AxiosProgressEvent, AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface UploadProgress {
  loaded: number;
  total: number;
  progress: number; // 0-100
}

export interface UploadResult {
  success: boolean;
  message: string;
  data?: {
    fileId: string;
    fileName: string;
    fileSize: number;
    duration: number;
    uploadedAt: string;
  };
  error?: string;
}

export interface FileValidationResult {
  valid: boolean;
  message?: string;
  code?: string;
  supportedTypes?: string[];
  supportedExtensions?: string[];
}

export interface RecordingFileInfo {
  fileId: string;
  participantId: string;
  participantName: string;
  fileName: string;
  fileSize: number;
  duration: number;
  mimeType: string;
  uploadedAt: string;
}

export interface RoomFilesResponse {
  success: boolean;
  message: string;
  data: {
    roomId: string;
    totalFiles: number;
    files: RecordingFileInfo[];
  };
}

/**
 * 파일 업로드 서비스 클래스
 */
export class UploadService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * 파일 업로드 전 검증
   */
  public async validateFile(
    fileName: string,
    fileSize: number,
    mimeType: string
  ): Promise<FileValidationResult> {
    try {
      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/upload/validate`,
        {
          fileName,
          fileSize,
          mimeType,
        }
      );

      return {
        valid: response.data.success,
        message: response.data.message,
      };
    } catch (error: any) {
      const errorData = error.response?.data || {};
      return {
        valid: false,
        message: errorData.message || '파일 검증 중 오류가 발생했습니다.',
        code: errorData.code,
        supportedTypes: errorData.supportedTypes,
        supportedExtensions: errorData.supportedExtensions,
      };
    }
  }

  /**
   * 단일 오디오 파일 업로드
   */
  public async uploadAudioFile(
    audioBlob: Blob,
    roomId: string,
    participantId: string,
    participantName: string,
    duration: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // FormData 생성
      const formData = new FormData();
      
      // 파일명 생성 (타임스탬프 + 참가자 ID)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `recording_${participantId}_${timestamp}.webm`;
      
      // FormData에 파일과 메타데이터 추가
      formData.append('audio', audioBlob, fileName);
      formData.append('roomId', roomId);
      formData.append('participantId', participantId);
      formData.append('participantName', participantName);
      formData.append('duration', duration.toString());

      // 업로드 진행률 콜백 설정
      const progressCallback = onProgress
        ? (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              const progress: UploadProgress = {
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                progress: Math.round((progressEvent.loaded / progressEvent.total) * 100),
              };
              onProgress(progress);
            }
          }
        : undefined;

      // API 호출
      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/upload/audio`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: progressCallback,
          timeout: 60000, // 60초 타임아웃
        }
      );

      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error('파일 업로드 실패:', error);

      const errorData = error.response?.data || {};
      return {
        success: false,
        message: errorData.message || '파일 업로드에 실패했습니다.',
        error: errorData.code || 'UPLOAD_FAILED',
      };
    }
  }

  /**
   * 회의방별 녹음 파일 목록 조회
   */
  public async getRoomFiles(roomId: string): Promise<RoomFilesResponse> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/upload/room/${roomId}/files`
      );

      return response.data;
    } catch (error: any) {
      console.error('파일 목록 조회 실패:', error);
      throw new Error(error.response?.data?.message || '파일 목록 조회에 실패했습니다.');
    }
  }

  /**
   * 파일 다운로드 URL 생성
   */
  public getDownloadUrl(fileId: string): string {
    return `${this.baseURL}/upload/download/${fileId}`;
  }

  /**
   * 파일 삭제
   */
  public async deleteFile(fileId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response: AxiosResponse = await axios.delete(
        `${this.baseURL}/upload/${fileId}`
      );

      return {
        success: response.data.success,
        message: response.data.message,
      };
    } catch (error: any) {
      console.error('파일 삭제 실패:', error);
      return {
        success: false,
        message: error.response?.data?.message || '파일 삭제에 실패했습니다.',
      };
    }
  }

  /**
   * 업로드 서비스 상태 확인
   */
  public async checkHealth(): Promise<{ healthy: boolean; message: string }> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/upload/health`
      );

      return {
        healthy: response.data.success,
        message: response.data.message,
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: '업로드 서비스에 연결할 수 없습니다.',
      };
    }
  }

  /**
   * 파일 크기를 사람이 읽기 쉬운 형태로 변환
   */
  public static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 지원되는 오디오 파일 형식 확인
   */
  public static isSupportedAudioFile(file: File): boolean {
    const supportedTypes = [
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/webm',
      'audio/ogg',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a',
    ];

    return supportedTypes.includes(file.type);
  }

  /**
   * 최대 파일 크기 확인 (100MB)
   */
  public static isFileSizeValid(fileSize: number): boolean {
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    return fileSize <= maxFileSize;
  }
}

// 싱글톤 인스턴스
export const uploadService = new UploadService();

export default uploadService;
