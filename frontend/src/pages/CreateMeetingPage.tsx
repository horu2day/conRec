import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Clock, Mic, Sparkles, Copy, Check, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

const CreateMeetingPage = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    hostName: '',
    maxParticipants: 10,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.hostName.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setIsLoading(true)
    
    try {
      // TODO: API 호출로 회의방 생성
      // const response = await createRoom(formData)
      
      // 임시로 랜덤 ID 생성
      const roomId = Math.random().toString(36).substring(2, 15)
      
      // 회의방으로 이동
      navigate(`/meeting/${roomId}`, {
        state: { 
          isHost: true, 
          userName: formData.hostName,
          maxParticipants: formData.maxParticipants
        }
      })
    } catch (error) {
      console.error('회의방 생성 실패:', error)
      alert('회의방 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxParticipants' ? parseInt(value) || 10 : value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* 배경 그라데이션 오브젝트 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-purple-500/20 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/20 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-emerald-500/10 rounded-full filter blur-3xl animate-pulse delay-500"></div>
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
                <ArrowLeft className="w-5 h-5 group-hover:text-purple-300 transition-colors" />
              </Link>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black">회의방 생성</h1>
                  <p className="text-sm text-gray-400">새로운 회의실을 만들어보세요</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="relative z-10 p-6">
        <div className="max-w-4xl mx-auto">
          
          {/* 대형 타이포그래피 섹션 */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full px-6 py-3 mb-6 border border-purple-500/30">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-semibold text-purple-300 uppercase tracking-wider">간편한 설정</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                CREATE
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                YOUR ROOM
              </span>
            </h2>
            
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              몇 분만에 <span className="text-white font-semibold">전문적인 회의실</span>을 만들고
              <br />
              <span className="text-purple-300">팀원들을 초대하세요</span>
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            
            {/* 폼 섹션 - Glassmorphism */}
            <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
                    <Mic className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">회의실 설정</h3>
                    <p className="text-gray-400">기본 정보를 입력해주세요</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* 이름 입력 */}
                  <div className="space-y-2">
                    <label htmlFor="hostName" className="block text-lg font-semibold text-white">
                      진행자 이름 *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="hostName"
                        name="hostName"
                        value={formData.hostName}
                        onChange={handleInputChange}
                        placeholder="이름을 입력하세요"
                        className="w-full px-6 py-4 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:bg-white/10 transition-all duration-300 text-lg"
                        required
                        maxLength={50}
                      />
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">
                      다른 참여자들에게 표시될 이름입니다
                    </p>
                  </div>

                  {/* 최대 참여자 수 */}
                  <div className="space-y-2">
                    <label htmlFor="maxParticipants" className="block text-lg font-semibold text-white">
                      최대 참여자 수
                    </label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        id="maxParticipants"
                        name="maxParticipants"
                        value={formData.maxParticipants}
                        onChange={handleInputChange}
                        min="2"
                        max="50"
                        className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/20 rounded-2xl text-white focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all duration-300 text-lg"
                      />
                    </div>
                    <p className="text-sm text-gray-400">
                      회의에 참여할 수 있는 최대 인원 (2-50명)
                    </p>
                  </div>

                  {/* 제출 버튼 */}
                  <button
                    type="submit"
                    disabled={isLoading || !formData.hostName.trim()}
                    className="group relative w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 rounded-2xl py-5 text-xl font-bold transition-all duration-300 hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-2xl"
                  >
                    <div className="flex items-center justify-center space-x-3">
                      {isLoading ? (
                        <>
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>회의방 생성 중...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-6 h-6" />
                          <span>회의방 생성하기</span>
                        </>
                      )}
                    </div>
                    
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                  </button>
                </form>
              </div>
            </div>

            {/* 안내 섹션 */}
            <div className="space-y-6">
              
              {/* 특징 카드들 */}
              {[
                {
                  icon: Mic,
                  title: "개별 녹음",
                  description: "각 참여자가 자신의 음성을 개별로 녹음하여 고품질 회의록을 생성합니다.",
                  gradient: "from-purple-500 to-pink-500"
                },
                {
                  icon: Clock,
                  title: "실시간 제어",
                  description: "회의 진행자가 모든 참여자의 녹음을 중앙에서 통제할 수 있습니다.",
                  gradient: "from-blue-500 to-cyan-500"
                },
                {
                  icon: Sparkles,
                  title: "AI 전사",
                  description: "회의 종료 후 자동으로 음성을 텍스트로 변환하여 회의록을 생성합니다.",
                  gradient: "from-emerald-500 to-teal-500"
                }
              ].map((feature, index) => (
                <div 
                  key={index}
                  className="group backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-500 hover:scale-105"
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2 group-hover:text-white transition-colors">
                        {feature.title}
                      </h4>
                      <p className="text-gray-300 group-hover:text-gray-200 transition-colors">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* 소요 시간 안내 */}
              <div className="backdrop-blur-xl bg-gradient-to-r from-white/5 to-white/10 border border-white/20 rounded-2xl p-6">
                <div className="flex items-center space-x-3 mb-3">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">처리 시간 안내</span>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  회의 종료 후 음성 파일 업로드 및 AI 전사 처리에 
                  <span className="text-white font-semibold"> 약 2-5분</span>이 소요됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 지원 섹션 */}
          <div className="text-center mt-16">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 inline-block">
              <p className="text-gray-400">
                문제가 발생하거나 도움이 필요하시면{' '}
                <a 
                  href="mailto:support@conrec.com" 
                  className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                >
                  지원팀에 문의
                </a>
                해주세요
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default CreateMeetingPage