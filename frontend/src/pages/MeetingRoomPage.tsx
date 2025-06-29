import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Mic, MicOff, Users, Clock, Settings, LogOut, Copy, Check, Zap, Shield, AlertCircle } from 'lucide-react'
import useMeetingStore from '../stores/meetingStore'
import toast from 'react-hot-toast'

interface LocationState {
  isHost: boolean
  userName: string
  maxParticipants?: number
}

const MeetingRoomPage = () => {
  const { roomId } = useParams<{ roomId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  
  const state = location.state as LocationState
  const [linkCopied, setLinkCopied] = useState(false)
  
  // MeetingStore 상태 연결
  const {
    // 상태
    isConnected,
    currentRoom,
    isHost: storeIsHost,
    participantName,
    isRecording,
    recordingDuration,
    recordingStartTime,
    isLoading,
    error,
    notifications,
    
    // 액션
    connect,
    joinRoom,
    createRoom,
    startRecording,
    stopRecording,
    leaveRoom,
    setError,
    clearError,
    removeNotification
  } = useMeetingStore()

  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true)
  const [meetingDuration, setMeetingDuration] = useState(0)

  // 초기화 및 연결
  useEffect(() => {
    if (!isConnected) {
      connect()
    }
  }, [isConnected, connect])

  // 회의방 입장 로직
  useEffect(() => {
    const initializeRoom = async () => {
      console.log('🔍 회의방 초기화:', { roomId, state, isConnected, currentRoom })
      
      if (!roomId || !state) {
        console.error('❌ roomId 또는 state가 없습니다.')
        return
      }

      // Socket 연결 대기
      if (!isConnected) {
        console.log('🔄 Socket 연결 대기 중...')
        return // 연결되면 다시 실행됨
      }

      try {
        if (state.isHost) {
          console.log('🎯 호스트 모드 - 회의방 상태 확인')
          // 호스트인 경우: 회의방이 없어도 계속 진행 (이미 생성되었을 수 있음)
          if (!currentRoom || currentRoom.id !== roomId) {
            console.log('⚠️ 호스트의 currentRoom이 없음 - 계속 진행')
            // 호스트 연결이 끊어졌을 수 있으므로 회의방 재생성하지 않고 기다림
          }
        } else {
          console.log('👥 참여자 모드 - 회의방 참여 시도')
          // 참여자인 경우: 방에 입장 시도
          if (!currentRoom || currentRoom.id !== roomId) {
            console.log('🔄 회의방 참여 시도:', { roomId, userName: state.userName })
            const result = await joinRoom(roomId, state.userName)
            console.log('🔍 참여 결과:', result)
            
            if (!result.success) {
              console.error('❌ 회의방 참여 실패:', result.error)
              toast.error(result.error || '회의방 참여에 실패했습니다.')
              // 즉시 홈으로 이동하지 않고 재시도 기회 제공
              setTimeout(() => {
                console.log('🔄 5초 후 홈으로 이동...')
                navigate('/')
              }, 5000)
              return
            }
            console.log('✅ 회의방 참여 성공')
          } else {
            console.log('✅ 이미 회의방에 참여됨')
          }
        }
      } catch (error) {
        console.error('❌ 회의방 초기화 예외:', error)
        toast.error('회의방 연결에 실패했습니다.')
        // 3초 후 홈으로 이동
        setTimeout(() => {
          navigate('/')
        }, 3000)
      }
    }

    initializeRoom()
  }, [roomId, state, isConnected, currentRoom, joinRoom, navigate])

  // 회의 시간 추적
  useEffect(() => {
    let timer: NodeJS.Timeout
    
    if (isRecording && recordingStartTime) {
      timer = setInterval(() => {
        const elapsed = Date.now() - new Date(recordingStartTime).getTime()
        setMeetingDuration(Math.floor(elapsed / 1000))
      }, 1000)
    } else if (!isRecording) {
      // 녹음이 중지되면 총 시간으로 설정
      if (recordingDuration > 0) {
        setMeetingDuration(Math.floor(recordingDuration / 1000))
      }
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isRecording, recordingStartTime, recordingDuration])

  // 알림 표시
  useEffect(() => {
    notifications.forEach(notification => {
      switch (notification.type) {
        case 'success':
          toast.success(notification.message)
          break
        case 'error':
          toast.error(notification.message)
          break
        case 'warning':
          toast.error(notification.message)
          break
        case 'info':
          toast(notification.message)
          break
      }
      removeNotification(notification.id)
    })
  }, [notifications, removeNotification])

  // 오류 표시
  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  // 시간 포맷팅 함수
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleRecordingToggle = async () => {
    if (!storeIsHost) {
      toast.error('호스트만 녹음을 제어할 수 있습니다.')
      return
    }

    try {
      if (isRecording) {
        const result = await stopRecording()
        if (!result.success) {
          toast.error(result.error || '녹음 중지에 실패했습니다.')
        }
      } else {
        const result = await startRecording()
        if (!result.success) {
          toast.error(result.error || '녹음 시작에 실패했습니다.')
        }
      }
    } catch (error) {
      console.error('녹음 제어 오류:', error)
      toast.error('녹음 제어에 실패했습니다.')
    }
  }

  const handleMicrophoneToggle = () => {
    setIsMicrophoneEnabled(!isMicrophoneEnabled)
    // TODO: 실제 마이크 제어 및 다른 참여자들에게 알림
    toast.success(isMicrophoneEnabled ? '마이크가 꺼졌습니다.' : '마이크가 켜졌습니다.')
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${roomId}`)
      setLinkCopied(true)
      toast.success('초대 링크가 복사되었습니다!')
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (error) {
      console.error('링크 복사 실패:', error)
      toast.error('링크 복사에 실패했습니다.')
    }
  }

  const handleLeaveMeeting = () => {
    if (window.confirm('회의를 나가시겠습니까?')) {
      leaveRoom()
      navigate('/')
      toast.success('회의에서 나갔습니다.')
    }
  }

  // 로딩 중이거나 연결되지 않은 경우
  if (!isConnected || isLoading || !currentRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 text-center shadow-2xl">
          <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h2 className="text-3xl font-bold mb-4">
            {!isConnected ? '서버에 연결 중...' : '회의방 준비 중...'}
          </h2>
          <p className="text-gray-300">잠시만 기다려주세요</p>
        </div>
      </div>
    )
  }

  // 잘못된 접근인 경우
  if (!roomId || !state) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 text-center shadow-2xl">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">잘못된 접근입니다</h2>
          <p className="text-gray-300 mb-8">회의방 정보를 찾을 수 없습니다</p>
          <button 
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl font-semibold hover:from-purple-600 hover:to-blue-600 transition-all duration-300 hover:scale-105"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const participants = currentRoom.participants || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* 배경 그라데이션 오브젝트 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-purple-500/20 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/20 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* 헤더 - Glassmorphism */}
      <header className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-6 py-4 shadow-2xl">
            <div className="flex items-center justify-between">
              {/* 회의 정보 */}
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black">회의방 {roomId}</h1>
                    <p className="text-gray-400 flex items-center space-x-2">
                      <span>{storeIsHost ? '진행자' : '참여자'}</span>
                      <span>•</span>
                      <span>{participantName || state.userName}</span>
                      {storeIsHost && (
                        <>
                          <span>•</span>
                          <span className="text-purple-400 font-semibold">HOST</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* 실시간 상태 */}
                <div className="hidden md:flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                    <span className="text-sm font-medium">
                      {isRecording ? 'REC' : 'STANDBY'}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono text-lg font-bold">{formatDuration(meetingDuration)}</span>
                  </div>
                </div>
              </div>

              {/* 컨트롤 버튼들 */}
              <div className="flex items-center space-x-3">
                <button className="p-3 hover:bg-white/10 rounded-xl transition-all duration-300 hover:scale-105">
                  <Settings className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleLeaveMeeting}
                  className="p-3 hover:bg-red-500/20 text-red-400 rounded-xl transition-all duration-300 hover:scale-105"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="relative z-10 p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* 중앙 녹음 컨트롤 */}
            <div className="lg:col-span-2">
              <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 text-center shadow-2xl min-h-[600px] flex flex-col justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-3xl"></div>
                
                <div className="relative z-10">
                  {/* 타이머 디스플레이 */}
                  <div className="mb-12">
                    <div className={`text-8xl font-black font-mono mb-4 transition-all duration-500 ${
                      isRecording 
                        ? 'text-transparent bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text' 
                        : 'text-gray-400'
                    }`}>
                      {formatDuration(meetingDuration)}
                    </div>
                    <p className="text-2xl font-semibold">
                      {isRecording ? (
                        <span className="text-red-400 flex items-center justify-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                          <span>녹음 진행 중</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">녹음 대기</span>
                      )}
                    </p>
                  </div>

                  {/* 메인 녹음 버튼 - 호스트만 */}
                  {storeIsHost && (
                    <div className="mb-12">
                      <button
                        onClick={handleRecordingToggle}
                        disabled={isLoading}
                        className={`group relative w-48 h-48 rounded-full flex items-center justify-center mx-auto transition-all duration-500 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isRecording 
                            ? 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/50 shadow-2xl' 
                            : 'bg-gradient-to-br from-gray-600 to-gray-700 hover:from-purple-500 hover:to-blue-500 shadow-xl'
                        }`}
                      >
                        {/* 펄스 애니메이션 */}
                        {isRecording && (
                          <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75"></div>
                        )}
                        
                        <div className="relative z-10">
                          {isLoading ? (
                            <div className="animate-spin w-20 h-20 border-4 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            <Mic className="w-20 h-20 text-white" />
                          )}
                        </div>
                        
                        {/* 호버 효과 */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </button>
                      
                      <p className="text-lg text-gray-300 mt-6">
                        {isRecording ? '클릭하여 녹음 중지' : '클릭하여 녹음 시작'}
                      </p>
                    </div>
                  )}

                  {/* 개인 컨트롤 */}
                  <div className="flex justify-center space-x-6">
                    <button
                      onClick={handleMicrophoneToggle}
                      className={`group flex items-center space-x-3 px-8 py-4 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 ${
                        isMicrophoneEnabled 
                          ? 'bg-white/10 hover:bg-white/20 border border-white/20' 
                          : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                      }`}
                    >
                      {isMicrophoneEnabled ? (
                        <>
                          <Mic className="w-5 h-5" />
                          <span>마이크 켜짐</span>
                        </>
                      ) : (
                        <>
                          <MicOff className="w-5 h-5" />
                          <span>마이크 꺼짐</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 호스트 안내 메시지 */}
                  {storeIsHost && (
                    <div className="mt-12 backdrop-blur-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-2xl p-6">
                      <div className="flex items-start space-x-3">
                        <Shield className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0" />
                        <div>
                          <h4 className="font-bold text-purple-400 mb-2">진행자 권한</h4>
                          <p className="text-gray-300 leading-relaxed">
                            큰 녹음 버튼을 클릭하여 모든 참여자의 녹음을 동시에 제어할 수 있습니다. 
                            회의가 끝나면 개별 음성 파일이 자동으로 업로드됩니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 참여자 목록 */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* 참여자 목록 카드 */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center space-x-3 mb-6">
                  <Users className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-2xl font-bold">참여자</h3>
                  <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-semibold">
                    {participants.length}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {participants.map((participant, index) => (
                    <div 
                      key={participant.id}
                      className="group backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center ${
                            participant.isHost 
                              ? 'bg-gradient-to-br from-purple-500 to-blue-500' 
                              : 'bg-gradient-to-br from-emerald-500 to-teal-500'
                          }`}>
                            <span className="text-lg font-bold">
                              {participant.name.charAt(0).toUpperCase()}
                            </span>
                            {participant.isHost && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="font-semibold text-white">{participant.name}</p>
                              {participant.isHost && (
                                <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-lg text-xs font-bold">
                                  HOST
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <p className="text-sm text-gray-400">
                                {participant.recordingStatus === 'recording' ? '녹음 중' : 
                                 participant.recordingStatus === 'stopped' ? '녹음 완료' : '대기 중'}
                              </p>
                              
                              {/* 음성 레벨 표시 (임시) */}
                              <div className="flex items-center space-x-1">
                                {[...Array(5)].map((_, i) => (
                                  <div 
                                    key={i}
                                    className={`w-1 h-3 rounded-full transition-all duration-200 ${
                                      i < 2 ? 'bg-emerald-400' : 'bg-gray-600'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Mic className="w-5 h-5 text-emerald-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 초대 링크 카드 */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center space-x-3 mb-4">
                  <Zap className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-bold">초대 링크</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-sm text-gray-400 mb-2">회의 ID</p>
                    <p className="font-mono text-lg font-bold text-white">{roomId}</p>
                  </div>
                  
                  <button 
                    onClick={handleCopyLink}
                    className="group w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-2xl font-semibold transition-all duration-300 hover:scale-105"
                  >
                    {linkCopied ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span>링크 복사됨!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        <span>초대 링크 복사</span>
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-gray-400 text-center">
                    이 링크를 공유하여 다른 사람들을 초대하세요
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default MeetingRoomPage