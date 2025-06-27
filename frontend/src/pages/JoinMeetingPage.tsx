import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Users, AlertCircle, CheckCircle, Sparkles, LogIn, Shield } from 'lucide-react'

const JoinMeetingPage = () => {
  const navigate = useNavigate()
  const { roomId: urlRoomId } = useParams()
  
  const [isLoading, setIsLoading] = useState(false)
  const [roomStatus, setRoomStatus] = useState<'checking' | 'valid' | 'invalid' | 'ended'>('checking')
  const [formData, setFormData] = useState({
    roomId: urlRoomId || '',
    userName: '',
  })

  // URL에 roomId가 있으면 자동으로 방 상태 확인
  useEffect(() => {
    if (urlRoomId) {
      checkRoomStatus(urlRoomId)
    } else {
      setRoomStatus('valid') // roomId 입력 대기
    }
  }, [urlRoomId])

  const checkRoomStatus = async (roomId: string) => {
    if (!roomId.trim()) {
      setRoomStatus('valid')
      return
    }

    setRoomStatus('checking')
    
    try {
      // TODO: API 호출로 방 상태 확인
      // const response = await checkRoom(roomId)
      
      // 임시 로직 - 실제로는 서버에서 확인
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 랜덤하게 성공/실패 시뮬레이션 (개발용)
      const isValid = Math.random() > 0.3
      setRoomStatus(isValid ? 'valid' : 'invalid')
      
    } catch (error) {
      console.error('방 상태 확인 실패:', error)
      setRoomStatus('invalid')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.roomId.trim()) {
      alert('회의 ID를 입력해주세요.')
      return
    }
    
    if (!formData.userName.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    if (roomStatus !== 'valid') {
      alert('유효하지 않은 회의방입니다.')
      return
    }

    setIsLoading(true)
    
    try {
      // TODO: API 호출로 회의 참여
      // const response = await joinRoom(formData)
      
      // 회의방으로 이동
      navigate(`/meeting/${formData.roomId}`, {
        state: { 
          isHost: false, 
          userName: formData.userName 
        }
      })
    } catch (error) {
      console.error('회의 참여 실패:', error)
      alert('회의 참여에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // roomId 변경 시 상태 확인
    if (name === 'roomId') {
      const trimmedValue = value.trim()
      if (trimmedValue.length > 5) {
        checkRoomStatus(trimmedValue)
      } else {
        setRoomStatus('valid')
      }
    }
  }

  const getRoomStatusDisplay = () => {
    switch (roomStatus) {
      case 'checking':
        return (
          <div className="flex items-center space-x-2 text-blue-400 mt-3">
            <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-sm">회의방 확인 중...</span>
          </div>
        )
      case 'valid':
        return formData.roomId.trim().length > 5 ? (
          <div className="flex items-center space-x-2 text-emerald-400 mt-3">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">유효한 회의방입니다</span>
          </div>
        ) : null
      case 'invalid':
        return (
          <div className="flex items-center space-x-2 text-red-400 mt-3">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">존재하지 않는 회의방입니다</span>
          </div>
        )
      case 'ended':
        return (
          <div className="flex items-center space-x-2 text-orange-400 mt-3">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">종료된 회의방입니다</span>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* 배경 그라데이션 오브젝트 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-emerald-500/20 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-500/10 rounded-full filter blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* 헤더 - Glassmorphism */}
      <header className="relative z-10 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-6 py-4 shadow-2xl">
            <div className="flex items-center space-x-4">
              <Link 
                to="/" 
                className="group p-3 hover:bg-white/10 rounded-xl transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="w-5 h-5 group-hover:text-emerald-300 transition-colors" />
              </Link>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black">회의 참여</h1>
                  <p className="text-sm text-gray-400">기존 회의실에 입장하세요</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="relative z-10 p-6 flex items-center justify-center min-h-[80vh]">
        <div className="max-w-2xl w-full">
          
          {/* 대형 타이포그래피 섹션 */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-full px-6 py-3 mb-6 border border-emerald-500/30">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300 uppercase tracking-wider">즉시 참여</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
                JOIN
              </span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                MEETING
              </span>
            </h2>
            
            <p className="text-xl text-gray-300 max-w-xl mx-auto">
              <span className="text-white font-semibold">간단한 정보 입력</span>만으로
              <br />
              <span className="text-emerald-300">즉시 회의에 참여하세요</span>
            </p>
          </div>

          {/* 메인 폼 카드 - Glassmorphism */}
          <div className="relative backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl max-w-lg mx-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 rounded-3xl"></div>
            
            <div className="relative z-10">
              
              <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* 회의 ID 입력 */}
                <div className="space-y-3">
                  <label htmlFor="roomId" className="block text-lg font-bold text-white">
                    회의 ID *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="roomId"
                      name="roomId"
                      value={formData.roomId}
                      onChange={handleInputChange}
                      placeholder="회의 ID를 입력하세요"
                      className="w-full px-6 py-4 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400 focus:bg-white/10 transition-all duration-300 text-lg"
                      required
                      disabled={!!urlRoomId} // URL에서 온 경우 수정 불가
                    />
                    {urlRoomId && (
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      </div>
                    )}
                  </div>
                  {getRoomStatusDisplay()}
                  {!urlRoomId && (
                    <p className="text-sm text-gray-400">
                      회의 주최자로부터 받은 회의 ID를 입력해주세요
                    </p>
                  )}
                </div>

                {/* 이름 입력 */}
                <div className="space-y-3">
                  <label htmlFor="userName" className="block text-lg font-bold text-white">
                    참여자 이름 *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="userName"
                      name="userName"
                      value={formData.userName}
                      onChange={handleInputChange}
                      placeholder="이름을 입력하세요"
                      className="w-full px-6 py-4 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all duration-300 text-lg"
                      required
                      maxLength={50}
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">
                    다른 참여자들에게 표시될 이름입니다
                  </p>
                </div>

                {/* 마이크 권한 안내 */}
                <div className="backdrop-blur-xl bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-2xl p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-orange-400 mb-1">마이크 권한 필요</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        회의 참여 시 브라우저에서 마이크 사용 권한을 요청합니다. 
                        녹음을 위해 반드시 허용해주세요.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 제출 버튼 */}
                <button
                  type="submit"
                  disabled={isLoading || !formData.roomId.trim() || !formData.userName.trim() || roomStatus !== 'valid'}
                  className="group relative w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 rounded-2xl py-5 text-xl font-bold transition-all duration-300 hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-2xl"
                >
                  <div className="flex items-center justify-center space-x-3">
                    {isLoading ? (
                      <>
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>참여 중...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-6 h-6" />
                        <span>회의 참여하기</span>
                      </>
                    )}
                  </div>
                  
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </button>
              </form>
            </div>
          </div>

          {/* 회의방 생성 링크 */}
          <div className="text-center mt-12">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 inline-block">
              <p className="text-gray-400 mb-3">
                회의방이 없으신가요?
              </p>
              <Link 
                to="/create" 
                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
              >
                <Users className="w-5 h-5" />
                <span>새로운 회의방 생성하기</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default JoinMeetingPage