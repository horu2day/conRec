/**
 * 마이크 권한 관리 커스텀 훅
 * 
 * 기능:
 * - Permissions API를 통한 실시간 권한 상태 감지
 * - getUserMedia()를 통한 권한 요청
 * - 브라우저 호환성 처리
 * - 자동 권한 상태 업데이트
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export type MicrophonePermissionState = 
  | 'checking'     // 권한 상태 확인 중
  | 'prompt'       // 권한이 필요함 (아직 요청되지 않음)
  | 'granted'      // 권한 허용됨
  | 'denied'       // 권한 거부됨
  | 'requesting'   // 권한 요청 중
  | 'unavailable'  // 마이크 사용 불가능
  | 'error'        // 오류 발생

export interface MicrophonePermissionHookReturn {
  // 상태
  permissionState: MicrophonePermissionState
  stream: MediaStream | null
  error: string | null
  isSupported: boolean
  
  // 액션
  requestPermission: () => Promise<MediaStream | null>
  refreshPermissionState: () => Promise<void>
  stopStream: () => void
  
  // 유틸리티
  hasPermission: boolean
  needsPermission: boolean
  canRequest: boolean
}

export const useMicrophonePermission = (): MicrophonePermissionHookReturn => {
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>('checking')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  
  const permissionRef = useRef<PermissionStatus | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 브라우저 지원 확인
  useEffect(() => {
    const checkSupport = () => {
      const hasUserMedia = !!(
        navigator.mediaDevices && 
        navigator.mediaDevices.getUserMedia
      )
      
      setIsSupported(hasUserMedia)
      
      if (!hasUserMedia) {
        setPermissionState('unavailable')
        setError('이 브라우저는 마이크를 지원하지 않습니다.')
      }
      
      console.log('🔍 마이크 지원 확인:', {
        hasUserMedia,
        hasPermissionsAPI: 'permissions' in navigator,
        userAgent: navigator.userAgent
      })
    }

    checkSupport()
  }, [])

  // 권한 상태 확인 및 감지
  const refreshPermissionState = useCallback(async () => {
    if (!isSupported) {
      return
    }

    try {
      setError(null)
      
      // Permissions API 사용 가능한 경우
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ 
            name: 'microphone' as PermissionName 
          })
          
          console.log('🔐 Permissions API 결과:', permission.state)
          
          // 이전 리스너 제거
          if (permissionRef.current) {
            permissionRef.current.removeEventListener('change', handlePermissionChange)
          }
          
          // 새 권한 상태 저장 및 리스너 등록
          permissionRef.current = permission
          permission.addEventListener('change', handlePermissionChange)
          
          // 상태 업데이트
          updatePermissionState(permission.state)
          
        } catch (permissionError) {
          console.warn('⚠️ Permissions API 실패, fallback 사용:', permissionError)
          await checkPermissionWithFallback()
        }
      } else {
        console.warn('⚠️ Permissions API 지원하지 않음, fallback 사용')
        await checkPermissionWithFallback()
      }
      
    } catch (error) {
      console.error('❌ 권한 상태 확인 중 오류:', error)
      setPermissionState('error')
      setError('권한 상태를 확인할 수 없습니다.')
    }
  }, [isSupported])

  // Permissions API 미지원 시 fallback 방식
  const checkPermissionWithFallback = async () => {
    try {
      // 빠른 getUserMedia 테스트 (시간 측정으로 권한 상태 추정)
      const startTime = Date.now()
      
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      })
      
      const duration = Date.now() - startTime
      console.log('⏱️ getUserMedia 응답 시간:', duration + 'ms')
      
      // 즉시 정리
      testStream.getTracks().forEach(track => track.stop())
      
      // 500ms 미만이면 이미 권한이 있었던 것으로 판단
      if (duration < 500) {
        setPermissionState('granted')
      } else {
        setPermissionState('granted') // 성공하면 granted
      }
      
    } catch (error) {
      const err = error as DOMException
      console.log('🚫 fallback getUserMedia 실패:', err.name, err.message)
      
      switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          setPermissionState('denied')
          break
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          setPermissionState('unavailable')
          setError('마이크를 찾을 수 없습니다.')
          break
        default:
          setPermissionState('prompt')
      }
    }
  }

  // 권한 상태 변경 핸들러
  const handlePermissionChange = useCallback(() => {
    if (permissionRef.current) {
      console.log('🔄 권한 상태 변경 감지:', permissionRef.current.state)
      updatePermissionState(permissionRef.current.state)
    }
  }, [])

  // 권한 상태 업데이트
  const updatePermissionState = (state: string) => {
    switch (state) {
      case 'granted':
        setPermissionState('granted')
        break
      case 'denied':
        setPermissionState('denied')
        break
      case 'prompt':
        setPermissionState('prompt')
        break
      default:
        setPermissionState('prompt')
    }
  }

  // 초기 권한 상태 확인
  useEffect(() => {
    if (isSupported) {
      refreshPermissionState()
    }
  }, [isSupported, refreshPermissionState])

  // 권한 요청 및 스트림 가져오기
  const requestPermission = useCallback(async (): Promise<MediaStream | null> => {
    if (!isSupported) {
      setError('이 브라우저는 마이크를 지원하지 않습니다.')
      return null
    }

    setPermissionState('requesting')
    setError(null)

    try {
      console.log('🎤 마이크 권한 요청 시작...')
      
      // 고품질 오디오 설정
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        },
        video: false
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      console.log('✅ 마이크 스트림 획득 성공:', {
        streamId: mediaStream.id,
        audioTracks: mediaStream.getAudioTracks().length,
        active: mediaStream.active
      })

      // 기존 스트림 정리
      stopStream()

      // 새 스트림 설정
      setStream(mediaStream)
      streamRef.current = mediaStream
      setPermissionState('granted')

      return mediaStream

    } catch (error) {
      const err = error as DOMException
      console.error('❌ 마이크 권한 요청 실패:', {
        name: err.name,
        message: err.message,
        code: err.code
      })

      let errorMessage = '마이크 접근이 거부되었습니다.'
      let newState: MicrophonePermissionState = 'denied'

      switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
          newState = 'denied'
          break
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          errorMessage = '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.'
          newState = 'unavailable'
          break
        case 'NotReadableError':
        case 'TrackStartError':
          errorMessage = '마이크가 다른 애플리케이션에서 사용 중입니다.'
          newState = 'error'
          break
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          errorMessage = '마이크 설정에 문제가 있습니다.'
          newState = 'error'
          break
        case 'NotSupportedError':
          errorMessage = '이 브라우저는 마이크를 지원하지 않습니다.'
          newState = 'unavailable'
          break
        case 'SecurityError':
          errorMessage = '보안상의 이유로 마이크에 접근할 수 없습니다. HTTPS 연결을 확인해주세요.'
          newState = 'error'
          break
        default:
          errorMessage = `마이크 접근 실패: ${err.message || '알 수 없는 오류'}`
          newState = 'error'
      }

      setError(errorMessage)
      setPermissionState(newState)
      return null
    }
  }, [isSupported])

  // 스트림 정리
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      console.log('🛑 기존 마이크 스트림 정리')
      streamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log('🔇 오디오 트랙 정지:', track.label)
      })
      streamRef.current = null
      setStream(null)
    }
  }, [])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopStream()
      if (permissionRef.current) {
        permissionRef.current.removeEventListener('change', handlePermissionChange)
      }
    }
  }, [stopStream, handlePermissionChange])

  // 파생 상태들
  const hasPermission = permissionState === 'granted'
  const needsPermission = permissionState === 'prompt' || permissionState === 'denied'
  const canRequest = isSupported && (permissionState === 'prompt' || permissionState === 'denied')

  return {
    // 상태
    permissionState,
    stream,
    error,
    isSupported,
    
    // 액션
    requestPermission,
    refreshPermissionState,
    stopStream,
    
    // 유틸리티
    hasPermission,
    needsPermission,
    canRequest
  }
}

export default useMicrophonePermission
