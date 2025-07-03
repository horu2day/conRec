/**
 * 파일 업로드 서비스 (수정된 버전)
 * - 오디오 파일 업로드 API 호출
 * - 업로드 진행률 추적
 * - 파일 검증 및 에러 처리
 * 
 * 🔧 버그 수정 (2025-07-01):
 * - API URL 수정: /api/upload-audio에서 /upload-audio로 변경
 * - 더 상세한 에러 로깅 추가
 * - 타임아웃 설정 조정
 * - CORS 및 FormData 처리 개선
 */

import axios, { AxiosProgressEvent, AxiosResponse, AxiosError } from 'axios';

// 백엔드 서버 직접 연결 (API prefix 제거)
const API_BASE_URL = 'http://localhost:3000';

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
    console.log('🔧 UploadService 초기화:', { baseURL: this.baseURL });
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
        `${this.baseURL}/api/upload/validate`,
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
   * 단일 오디오 파일 업로드 (수정된 버전)
   */
  public async uploadAudioFile(
    audioBlob: Blob,
    roomId: string,
    participantId: string,
    participantName: string,
    duration: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    console.log('📤 uploadAudioFile 시작:', {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      roomId,
      participantId,
      participantName,
      duration,
      baseURL: this.baseURL
    });

    try {
      // FormData 생성
      const formData = new FormData();
      
      // 파일명 생성 (타임스탬프 + 참가자 ID)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `recording_${participantId}_${timestamp}.webm`;
      
      console.log('📋 FormData 구성:', {
        fileName,
        audioBlob: {
          size: audioBlob.size,
          type: audioBlob.type
        },
        roomId,
        participantId,
        participantName,
        duration: duration.toString()
      });
      
      // FormData에 파일과 메타데이터 추가
      formData.append('audio', audioBlob, fileName);
      formData.append('roomId', roomId);
      formData.append('participantId', participantId);
      formData.append('participantName', participantName);
      formData.append('duration', duration.toString());

      // FormData 확인
      console.log('🔍 FormData 내용 확인:');
      for (let [key, value] of formData.entries()) {
        if (typeof value === 'object' && value && 'size' in value && 'type' in value) {
          console.log(`  ${key}:`, {
            name: (value as any).name || 'blob',
            size: (value as any).size,
            type: (value as any).type
          });
        } else {
          console.log(`  ${key}:`, value);
        }
      }

      // 업로드 진행률 콜백 설정
      const progressCallback = onProgress
        ? (progressEvent: AxiosProgressEvent) => {
            if (progressEvent.total) {
              const progress: UploadProgress = {
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                progress: Math.round((progressEvent.loaded / progressEvent.total) * 100),
              };
              console.log('📊 업로드 진행률:', progress);
              onProgress(progress);
            }
          }
        : undefined;

      // API URL 확인
      const uploadUrl = `${this.baseURL}/api/upload-audio`;
      console.log('🎯 업로드 URL:', uploadUrl);

      // API 호출
      console.log('🚀 Axios POST 요청 시작...');
      const response: AxiosResponse = await axios.post(
        uploadUrl,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            // 추가 헤더는 axios가 자동으로 boundary 설정하도록 생략
          },
          onUploadProgress: progressCallback,
          timeout: 120000, // 2분 타임아웃으로 증가
          withCredentials: false, // CORS 설정과 일치
        }
      );

      console.log('✅ 업로드 성공:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });

      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data,
      };

    } catch (error: any) {
      console.error('❌ 파일 업로드 실패 - 상세 에러:', {
        error,
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        } : 'No response',
        request: error.request ? {
          url: error.request.responseURL || error.config?.url,
          method: error.config?.method
        } : 'No request',
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          timeout: error.config.timeout
        } : 'No config'
      });

      // 에러 유형별 처리
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: '서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.',
          error: 'CONNECTION_REFUSED',
        };
      }

      if (error.code === 'NETWORK_ERROR') {
        return {
          success: false,
          message: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
          error: 'NETWORK_ERROR',
        };
      }

      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: '업로드 시간이 초과되었습니다. 파일 크기를 확인하고 다시 시도해주세요.',
          error: 'TIMEOUT',
        };
      }

      const errorData = error.response?.data || {};
      const errorMessage = errorData.message || error.message || '파일 업로드에 실패했습니다.';
      
      return {
        success: false,
        message: errorMessage,
        error: errorData.code || error.code || 'UPLOAD_FAILED',
      };
    }
  }

  /**
   * 회의방별 녹음 파일 목록 조회
   */
  public async getRoomFiles(roomId: string): Promise<RoomFilesResponse> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/api/rooms/${roomId}/recordings`
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
    return `${this.baseURL}/uploads/${fileId}`;
  }

  /**
   * 파일 삭제
   */
  public async deleteFile(fileId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response: AxiosResponse = await axios.delete(
        `${this.baseURL}/api/upload/${fileId}`
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
        `${this.baseURL}/health`
      );

      return {
        healthy: response.data.status === 'ok',
        message: response.data.message || 'Service is healthy',
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

  /**
   * 연결 테스트 함수
   */
  public async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('🔍 서버 연결 테스트 시작...');
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      
      console.log('✅ 서버 연결 테스트 성공:', response.data);
      return {
        success: true,
        message: '서버 연결 성공',
        details: response.data
      };
    } catch (error: any) {
      console.error('❌ 서버 연결 테스트 실패:', error);
      return {
        success: false,
        message: `서버 연결 실패: ${error.message}`,
        details: {
          code: error.code,
          url: `${this.baseURL}/health`
        }
      };
    }
  }
}

// 싱글톤 인스턴스
export const uploadService = new UploadService();

export default uploadService;
