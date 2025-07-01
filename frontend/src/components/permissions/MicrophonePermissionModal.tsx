/**
 * 마이크 권한 요청 모달 컴포넌트
 * 
 * 기능:
 * - Permissions API를 통한 권한 상태 확인
 * - 권한 요청 버튼으로 getUserMedia() 자동 트리거
 * - 브라우저별 권한 설정 가이드 제공
 * - 권한 거부 시 사용자 안내
 */

import React, { useState, useEffect } from 'react'
import { Mic, MicOff, AlertTriangle, Info, Settings, CheckCircle, XCircle } from 'lucide-react'

interface MicrophonePermissionModalProps {
  isOpen: boolean
  onClose: () => void
  onPermissionGranted: (stream: MediaStream) => void
  onPermissionDenied: (reason: string) => void
}

type PermissionState = 'checking' | 'prompt' | 'granted' | 'denied' | 'requesting' | 'error'

interface BrowserInfo {
  name: string
  settingsUrl?: string
  instructions: string[]
}

const MicrophonePermissionModal: React.FC<MicrophonePermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  onPermissionDenied
}) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string>('')
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null)
  const [showAdvancedHelp, setShowAdvancedHelp] = useState(false)

  // 브라우저 감지
  useEffect(() => {
    const detectBrowser = (): BrowserInfo => {
      const userAgent = navigator.userAgent.toLowerCase()
      
      if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
        return {
          name: 'Chrome',
          settingsUrl: 'chrome://settings/content/microphone',
          instructions: [
            '1. 주소창 왼쪽의 자물쇠 아이콘을 클릭하세요',
            '2. "마이크" 옆의 드롭다운을 클릭하세요',
            '3. "허용"을 선택하세요',
            '4. 페이지를 새로고침하세요'
          ]
        }
      } else if (userAgent.includes('firefox')) {
        return {
          name: 'Firefox',
          settingsUrl: 'about:preferences#privacy',
          instructions: [
            '1. 주소창 왼쪽의 방패 아이콘을 클릭하세요',
            '2. "마이크 차단됨" 옆의 "X"를 클릭하세요',
            '3. 권한을 허용으로 변경하세요',
            '4. 페이지를 새로고침하세요'
          ]
        }
      } else if (userAgent.includes('safari')) {
        return {
          name: 'Safari',
          instructions: [
            '1. Safari 메뉴 > 설정을 열어주세요',
            '2. "웹사이트" 탭을 클릭하세요',
            '3. "마이크"를 선택하세요',
            '4. 현재 웹사이트를 "허용"으로 설정하세요'
          ]
        }
      } else if (userAgent.includes('edg')) {
        return {
          name: 'Edge',
          settingsUrl: 'edge://settings/content/microphone',
          instructions: [
            '1. 주소창 왼쪽의 자물쇠 아이콘을 클릭하세요',
            '2. "마이크" 권한을 "허용"으로 변경하세요',
            '3. 페이지를 새로고침하세요'
          ]
        }
      } else {
        return {
          name: '브라우저',
          instructions: [
            '1. 주소창 근처의 권한 아이콘을 찾아주세요',
            '2. 마이크 권한을 허용으로 변경하세요',
            '3. 페이지를 새로고침하세요'
          ]
        }
      }
    }

    setBrowserInfo(detectBrowser())
  }, [])

  // 권한 상태 확인
  useEffect(() => {
    if (!isOpen) return

    const checkPermissionState = async () => {
      try {
        setPermissionState('checking')
        
        // Permissions API 지원 확인
        if ('permissions' in navigator) {
          try {
            const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
            console.log('🔐 현재 마이크 권한 상태:', permission.state)
            
            if (permission.state === 'granted') {
              setPermissionState('granted')
              // 이미 권한이 있으면 바로 스트림 가져오기
              requestMicrophoneAccess()
            } else if (permission.state === 'denied') {
              setPermissionState('denied')
            } else {
              setPermissionState('prompt')
            }
            
            // 권한 상태 변경 감지
            permission.addEventListener('change', () => {
              console.log('🔄 마이크 권한 상태 변경됨:', permission.state)
              if (permission.state === 'granted') {
                setPermissionState('granted')
                requestMicrophoneAccess()
              } else if (permission.state === 'denied') {
                setPermissionState('denied')
              }
            })
            
          } catch (error) {
            console.warn('⚠️ Permissions API 쿼리 실패:', error)
            setPermissionState('prompt')
          }
        } else {
          console.warn('⚠️ Permissions API 지원하지 않음')
          setPermissionState('prompt')
        }
        
      } catch (error) {
        console.error('❌ 권한 상태 확인 중 오류:', error)
        setPermissionState('error')
        setError('권한 상태를 확인할 수 없습니다.')
      }
    }

    checkPermissionState()
  }, [isOpen])

  // 마이크 권한 요청
  const requestMicrophoneAccess = async () => {
    console.log('🎤 마이크 권한 요청 시작...')
    setPermissionState('requesting')
    setError('')
    
    try {
      // getUserMedia()를 통한 권한 요청
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        },
        video: false
      })
      
      console.log('✅ 마이크 권한 허용됨:', {
        streamActive: mediaStream.active,
        audioTracks: mediaStream.getAudioTracks().length
      })
      
      setStream(mediaStream)
      setPermissionState('granted')
      
      // 성공 콜백 호출
      onPermissionGranted(mediaStream)
      
      // 1초 후 모달 자동 닫기
      setTimeout(() => {
        onClose()
      }, 1000)
      
    } catch (error) {
      console.error('❌ 마이크 권한 요청 실패:', error)
      
      const err = error as DOMException
      let errorMessage = '마이크 접근이 거부되었습니다.'
      
      switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.'
          setPermissionState('denied')
          break
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          errorMessage = '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.'
          setPermissionState('error')
          break
        case 'NotReadableError':
        case 'TrackStartError':
          errorMessage = '마이크가 다른 애플리케이션에서 사용 중입니다.'
          setPermissionState('error')
          break
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          errorMessage = '마이크 설정에 문제가 있습니다.'
          setPermissionState('error')
          break
        case 'NotSupportedError':
          errorMessage = '이 브라우저는 마이크를 지원하지 않습니다.'
          setPermissionState('error')
          break
        case 'SecurityError':
          errorMessage = '보안상의 이유로 마이크에 접근할 수 없습니다. HTTPS 연결을 확인해주세요.'
          setPermissionState('error')
          break
        default:
          errorMessage = `마이크 접근 실패: ${err.message || '알 수 없는 오류'}`
          setPermissionState('error')
      }
      
      setError(errorMessage)
      onPermissionDenied(errorMessage)
    }
  }

  // 스트림 정리
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  if (!isOpen) return null

  const renderPermissionContent = () => {
    switch (permissionState) {
      case 'checking':
        return (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">권한 상태를 확인하는 중...</p>
          </div>
        )

      case 'prompt':
        return (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              마이크 권한이 필요합니다
            </h3>
            <p className="text-gray-600 mb-6">
              음성 녹음을 위해 마이크 접근 권한을 허용해주세요.
              <br />
              버튼을 클릭하면 브라우저에서 권한을 요청합니다.
            </p>
            <button
              onClick={requestMicrophoneAccess}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <Mic className="w-5 h-5" />
              마이크 권한 허용
            </button>
          </div>
        )

      case 'requesting':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-pulse">
                <Mic className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              권한 요청 중...
            </h3>
            <p className="text-gray-600">
              브라우저에서 마이크 권한을 요청하고 있습니다.
              <br />
              <strong>"허용"</strong> 버튼을 클릭해주세요.
            </p>
          </div>
        )

      case 'granted':
        return (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              권한 허용 완료!
            </h3>
            <p className="text-green-600">
              마이크 권한이 성공적으로 허용되었습니다.
            </p>
          </div>
        )

      case 'denied':
        return (
          <div className="py-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
              마이크 권한이 거부되었습니다
            </h3>
            <p className="text-gray-600 mb-4 text-center">
              음성 녹음을 위해서는 마이크 권한이 필요합니다.
              <br />
              아래 방법으로 권한을 허용해주세요.
            </p>
            
            {browserInfo && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {browserInfo.name} 권한 설정 방법
                </h4>
                <ol className="text-sm text-gray-600 space-y-1">
                  {browserInfo.instructions.map((instruction, index) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={requestMicrophoneAccess}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                다시 시도
              </button>
              <button
                onClick={() => setShowAdvancedHelp(!showAdvancedHelp)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                자세한 도움말
              </button>
            </div>
          </div>
        )

      case 'error':
        return (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              오류가 발생했습니다
            </h3>
            <p className="text-red-600 mb-4">
              {error}
            </p>
            <button
              onClick={requestMicrophoneAccess}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              다시 시도
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">마이크 권한</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={permissionState === 'requesting'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {renderPermissionContent()}

          {showAdvancedHelp && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                추가 도움말
              </h4>
              <div className="text-sm text-blue-800 space-y-2">
                <p>• 마이크가 연결되어 있는지 확인하세요</p>
                <p>• 다른 프로그램에서 마이크를 사용하고 있지 않은지 확인하세요</p>
                <p>• 브라우저를 최신 버전으로 업데이트하세요</p>
                <p>• HTTPS 연결을 사용하고 있는지 확인하세요</p>
                <p>• 페이지를 새로고침한 후 다시 시도하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MicrophonePermissionModal
