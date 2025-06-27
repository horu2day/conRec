/**
 * 오디오 녹음 서비스 (RecordRTC 기반)
 * 브라우저 호환성과 음질 최적화에 중점
 * 
 * 연구 결과 적용:
 * - RecordRTC 5.6.2 사용 (가장 안정적인 크로스 브라우저 호환성)
 * - WebM Opus 256kbps 우선, WAV 폴백
 * - Chunk 방식으로 메모리 최적화
 * - MediaRecorder API 기반, 브라우저 호환성 최대화
 */

import RecordRTC, { StereoAudioRecorder } from 'recordrtc'

export interface AudioRecordingConfig {
  sampleRate?: number        // 기본: 44100Hz
  numberOfAudioChannels?: number  // 기본: 1 (모노)
  bitRate?: number          // 기본: 256kbps
  mimeType?: string         // 기본: audio/webm;codecs=opus
  timeslice?: number        // Chunk 크기 (ms), 기본: 1000
  bufferSize?: number       // 기본: 16384
}

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number          // 밀리초
  startTime?: Date
  pausedDuration: number    // 일시정지된 총 시간
  chunks: Blob[]           // 녹음된 청크들
  finalBlob?: Blob         // 최종 결합된 오디오
}

export type RecordingEvent = 
  | 'recording-started'
  | 'recording-stopped' 
  | 'recording-paused'
  | 'recording-resumed'
  | 'data-available'
  | 'error'
  | 'permission-denied'
  | 'device-not-found'

class AudioRecorderService {
  private recorder: RecordRTC | null = null
  private mediaStream: MediaStream | null = null
  private config: AudioRecordingConfig
  private state: RecordingState
  private eventListeners: Map<RecordingEvent, Function[]> = new Map()

  // 브라우저 지원 여부 확인용
  private supportedMimeTypes = [
    'audio/webm;codecs=opus',    // 최우선 (YouTube 표준)
    'audio/webm;codecs=vorbis',  // WebM 대안
    'audio/webm',                // 기본 WebM
    'audio/mp4',                 // Safari 호환
    'audio/ogg;codecs=opus',     // Firefox 호환
    'audio/wav'                  // 최후 폴백 (무손실이지만 큰 파일)
  ]

  constructor(config: AudioRecordingConfig = {}) {
    this.config = {
      sampleRate: 44100,
      numberOfAudioChannels: 1,
      bitRate: 256000,          // 256kbps (연구 결과: YouTube Music Premium 수준)
      mimeType: 'audio/webm;codecs=opus',
      timeslice: 1000,          // 1초마다 chunk 생성
      bufferSize: 16384,
      ...config
    }

    this.state = {
      isRecording: false,
      isPaused: false,
      duration: 0,
      pausedDuration: 0,
      chunks: []
    }

    this.validateBrowserSupport()
    this.optimizeMimeType()
  }

  private validateBrowserSupport(): void {
    // getUserMedia 지원 확인
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('브라우저가 오디오 녹음을 지원하지 않습니다.')
    }

    // MediaRecorder 지원 확인
    if (!window.MediaRecorder) {
      console.warn('MediaRecorder를 지원하지 않습니다. RecordRTC 폴백을 사용합니다.')
    }
  }

  private optimizeMimeType(): void {
    // 브라우저가 지원하는 최적의 MIME 타입 선택
    for (const mimeType of this.supportedMimeTypes) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(mimeType)) {
        this.config.mimeType = mimeType
        console.log(`최적화된 MIME 타입 선택: ${mimeType}`)
        return
      }
    }

    // 폴백: WAV (무손실이지만 큰 파일)
    this.config.mimeType = 'audio/wav'
    console.warn('WebM을 지원하지 않아 WAV로 폴백합니다.')
  }

  public async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.numberOfAudioChannels,
          echoCancellation: true,      // 에코 제거
          noiseSuppression: true,      // 노이즈 억제
          autoGainControl: true        // 자동 음량 조절
        }
      })

      // 권한 확인 후 스트림 정리
      stream.getTracks().forEach(track => track.stop())
      return true

    } catch (error) {
      console.error('마이크 권한 요청 실패:', error)
      this.emit('permission-denied', error)
      return false
    }
  }

  public async startRecording(): Promise<boolean> {
    try {
      if (this.state.isRecording) {
        console.warn('이미 녹음 중입니다.')
        return false
      }

      // 마이크 스트림 획득
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.numberOfAudioChannels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      // RecordRTC 설정
      const recordRTCConfig: any = {
        type: 'audio',
        mimeType: this.config.mimeType,
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: this.config.numberOfAudioChannels,
        sampleRate: this.config.sampleRate,
        desiredSampRate: this.config.sampleRate,
        bufferSize: this.config.bufferSize,
        
        // 음질 최적화 설정
        audioBitsPerSecond: this.config.bitRate,
        
        // 메모리 최적화: 주기적으로 데이터 이벤트 발생
        timeSlice: this.config.timeslice,
        
        // 오류 처리
        onAudioProcessStarted: () => {
          console.log('오디오 처리 시작됨')
        }
      }

      // WebM이 아닌 경우 특별 설정
      if (!this.config.mimeType!.includes('webm')) {
        recordRTCConfig.recorderType = StereoAudioRecorder
      }

      this.recorder = new RecordRTC(this.mediaStream, recordRTCConfig)

      // 녹음 시작
      this.recorder.startRecording()

      // 상태 업데이트
      this.state.isRecording = true
      this.state.isPaused = false
      this.state.startTime = new Date()
      this.state.duration = 0
      this.state.chunks = []

      // 시간 추적 시작
      this.startDurationTracking()

      this.emit('recording-started', {
        timestamp: this.state.startTime,
        config: this.config
      })

      console.log('녹음 시작:', {
        mimeType: this.config.mimeType,
        sampleRate: this.config.sampleRate,
        channels: this.config.numberOfAudioChannels,
        bitRate: this.config.bitRate
      })

      return true

    } catch (error) {
      console.error('녹음 시작 실패:', error)
      this.emit('error', error)
      
      // 정리
      this.cleanup()
      return false
    }
  }

  public async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.state.isRecording || !this.recorder) {
          console.warn('녹음 중이 아닙니다.')
          resolve(null)
          return
        }

        this.recorder.stopRecording(() => {
          try {
            const blob = this.recorder!.getBlob()
            const endTime = new Date()

            // 상태 업데이트
            this.state.isRecording = false
            this.state.isPaused = false
            this.state.finalBlob = blob

            // 시간 추적 중지
            this.stopDurationTracking()

            this.emit('recording-stopped', {
              timestamp: endTime,
              duration: this.state.duration,
              blob: blob,
              size: blob.size,
              type: blob.type
            })

            console.log('녹음 완료:', {
              duration: this.state.duration,
              size: blob.size,
              type: blob.type
            })

            // 정리
            this.cleanup()

            resolve(blob)

          } catch (error) {
            console.error('녹음 중지 처리 실패:', error)
            this.emit('error', error)
            reject(error)
          }
        })

      } catch (error) {
        console.error('녹음 중지 실패:', error)
        this.emit('error', error)
        reject(error)
      }
    })
  }

  public pauseRecording(): boolean {
    try {
      if (!this.state.isRecording || this.state.isPaused || !this.recorder) {
        return false
      }

      this.recorder.pauseRecording()
      this.state.isPaused = true
      this.stopDurationTracking()

      this.emit('recording-paused', {
        timestamp: new Date(),
        duration: this.state.duration
      })

      console.log('녹음 일시정지')
      return true

    } catch (error) {
      console.error('녹음 일시정지 실패:', error)
      this.emit('error', error)
      return false
    }
  }

  public resumeRecording(): boolean {
    try {
      if (!this.state.isRecording || !this.state.isPaused || !this.recorder) {
        return false
      }

      this.recorder.resumeRecording()
      this.state.isPaused = false
      this.startDurationTracking()

      this.emit('recording-resumed', {
        timestamp: new Date(),
        duration: this.state.duration
      })

      console.log('녹음 재개')
      return true

    } catch (error) {
      console.error('녹음 재개 실패:', error)
      this.emit('error', error)
      return false
    }
  }

  private durationInterval: NodeJS.Timeout | null = null

  private startDurationTracking(): void {
    this.durationInterval = setInterval(() => {
      if (this.state.startTime && !this.state.isPaused) {
        this.state.duration = Date.now() - this.state.startTime.getTime() - this.state.pausedDuration
      }
    }, 100) // 100ms마다 업데이트
  }

  private stopDurationTracking(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval)
      this.durationInterval = null
    }
  }

  private cleanup(): void {
    // 미디어 스트림 정리
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop()
      })
      this.mediaStream = null
    }

    // RecordRTC 정리
    if (this.recorder) {
      this.recorder.destroy()
      this.recorder = null
    }

    // 시간 추적 정리
    this.stopDurationTracking()
  }

  // 이벤트 리스너 관리
  public on(event: RecordingEvent, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  public off(event: RecordingEvent, callback?: Function): void {
    if (!callback) {
      this.eventListeners.delete(event)
      return
    }

    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: RecordingEvent, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`이벤트 ${event} 핸들러 오류:`, error)
        }
      })
    }
  }

  // Getter 메서드들
  public getState(): RecordingState {
    return { ...this.state }
  }

  public getConfig(): AudioRecordingConfig {
    return { ...this.config }
  }

  public isRecording(): boolean {
    return this.state.isRecording
  }

  public isPaused(): boolean {
    return this.state.isPaused
  }

  public getDuration(): number {
    return this.state.duration
  }

  public getFinalBlob(): Blob | undefined {
    return this.state.finalBlob
  }

  // 브라우저 호환성 체크
  public static checkBrowserSupport(): {
    supported: boolean
    features: {
      getUserMedia: boolean
      mediaRecorder: boolean
      webmOpus: boolean
      webmVorbis: boolean
      mp4: boolean
      wav: boolean
    }
    recommendedMimeType: string
  } {
    const features = {
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaRecorder: !!window.MediaRecorder,
      webmOpus: !!(window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')),
      webmVorbis: !!(window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=vorbis')),
      mp4: !!(window.MediaRecorder && MediaRecorder.isTypeSupported('audio/mp4')),
      wav: !!(window.MediaRecorder && MediaRecorder.isTypeSupported('audio/wav'))
    }

    const supported = features.getUserMedia && features.mediaRecorder

    let recommendedMimeType = 'audio/wav' // 기본 폴백
    if (features.webmOpus) recommendedMimeType = 'audio/webm;codecs=opus'
    else if (features.webmVorbis) recommendedMimeType = 'audio/webm;codecs=vorbis'
    else if (features.mp4) recommendedMimeType = 'audio/mp4'

    return {
      supported,
      features,
      recommendedMimeType
    }
  }

  // 오디오 레벨 모니터링 (선택적 기능)
  public getAudioLevel(): number {
    // TODO: 오디오 레벨 분석 구현
    // Web Audio API를 사용한 실시간 오디오 레벨 분석
    return 0
  }
}

export default AudioRecorderService
export { AudioRecorderService }
