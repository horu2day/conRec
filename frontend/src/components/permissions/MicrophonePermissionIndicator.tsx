/**
 * 마이크 권한 상태 인디케이터 컴포넌트
 * 
 * 기능:
 * - 실시간 권한 상태 표시
 * - 권한 상태에 따른 시각적 피드백
 * - 클릭 시 권한 모달 열기
 */

import React, { useState, useEffect } from 'react'
import { Mic, MicOff, AlertTriangle, CheckCircle } from 'lucide-react'

interface MicrophonePermissionIndicatorProps {
  onRequestPermission: () => void
  className?: string
}

type PermissionStatus = 'checking' | 'granted' | 'denied' | 'prompt' | 'unavailable'

const MicrophonePermissionIndicator: React.FC<MicrophonePermissionIndicatorProps> = ({
  onRequestPermission,
  className = ''
}) => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking')
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const checkPermissionStatus = async () => {
      try {
        // 기본 지원 확인
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setPermissionStatus('unavailable')
          return
        }

        // Permissions API 지원 확인
        if ('permissions' in navigator) {
          try {
            const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
            setPermissionStatus(permission.state as PermissionStatus)
            
            // 권한 상태 변경 감지
            permission.addEventListener('change', () => {
              setPermissionStatus(permission.state as PermissionStatus)
            })
          } catch (error) {
            console.warn('Permissions API 사용 불가:', error)
            // Fallback: getUserMedia로 상태 확인
            checkWithGetUserMedia()
          }
        } else {
          // Fallback: getUserMedia로 상태 확인
          checkWithGetUserMedia()
        }
      } catch (error) {
        console.error('권한 상태 확인 중 오류:', error)
        setPermissionStatus('unavailable')
      }
    }

    const checkWithGetUserMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop()) // 즉시 정리
        setPermissionStatus('granted')
      } catch (error) {
        const err = error as DOMException
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionStatus('denied')
        } else {
          setPermissionStatus('prompt')
        }
      }
    }

    checkPermissionStatus()
  }, [])

  const getStatusConfig = () => {
    switch (permissionStatus) {
      case 'checking':
        return {
          icon: <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          label: '확인 중...',
          description: '마이크 권한 상태를 확인하고 있습니다.',
          clickable: false
        }
      case 'granted':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'text-green-600',
          bgColor: 'bg-green-100 hover:bg-green-200',
          label: '권한 허용됨',
          description: '마이크 권한이 허용되어 녹음이 가능합니다.',
          clickable: false
        }
      case 'denied':
        return {
          icon: <MicOff className="w-4 h-4" />,
          color: 'text-red-600',
          bgColor: 'bg-red-100 hover:bg-red-200',
          label: '권한 거부됨',
          description: '마이크 권한이 거부되었습니다. 클릭하여 권한을 허용하세요.',
          clickable: true
        }
      case 'prompt':
        return {
          icon: <Mic className="w-4 h-4" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100 hover:bg-yellow-200',
          label: '권한 필요',
          description: '마이크 권한이 필요합니다. 클릭하여 권한을 요청하세요.',
          clickable: true
        }
      case 'unavailable':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          label: '사용 불가',
          description: '이 브라우저는 마이크를 지원하지 않습니다.',
          clickable: false
        }
      default:
        return {
          icon: <Mic className="w-4 h-4" />,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          label: '알 수 없음',
          description: '권한 상태를 확인할 수 없습니다.',
          clickable: false
        }
    }
  }

  const config = getStatusConfig()

  const handleClick = () => {
    if (config.clickable) {
      onRequestPermission()
    }
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={!config.clickable}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
          ${config.bgColor}
          ${config.color}
          ${config.clickable ? 'cursor-pointer transform hover:scale-105' : 'cursor-default'}
          ${!config.clickable ? 'opacity-75' : ''}
        `}
        title={config.description}
      >
        {config.icon}
        <span className="text-sm font-medium">{config.label}</span>
      </button>

      {/* 툴팁 */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10">
          {config.description}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

export default MicrophonePermissionIndicator
