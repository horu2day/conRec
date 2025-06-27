import { Link } from 'react-router-dom'
import { Mic, Users, Play, Shield, Sparkles, Zap, Globe } from 'lucide-react'

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* 배경 그라데이션 오브젝트 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/20 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/20 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full filter blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* 헤더 - Glassmorphism */}
      <header className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-6 py-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <Mic className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white animate-ping"></div>
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">conRec</h1>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">MEETING RECORDER</p>
                </div>
              </div>
              
              <nav className="hidden md:flex items-center space-x-4">
                <Link 
                  to="/join" 
                  className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105"
                >
                  회의 참여
                </Link>
                <Link 
                  to="/create" 
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  회의 생성
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="relative z-10 px-6 py-16">
        <div className="max-w-7xl mx-auto">
          
          {/* 히어로 섹션 - 대형 타이포그래피 */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full px-6 py-3 mb-8 border border-purple-500/30">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-semibold text-purple-300 uppercase tracking-wider">2025 차세대 기술</span>
            </div>
            
            <h2 className="text-6xl md:text-8xl font-black mb-8 leading-tight">
              <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                MEETING
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                REIMAGINED
              </span>
            </h2>
            
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              개별 녹음과 실시간 AI 전사로 
              <span className="text-white font-semibold"> 완벽한 회의록</span>을 만들어보세요.
              <br />
              <span className="text-purple-300">브라우저만 있으면 어디서나.</span>
            </p>
            
            {/* CTA 버튼 그룹 */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link 
                to="/create" 
                className="group relative px-12 py-5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl text-xl font-bold hover:from-purple-600 hover:to-blue-600 transition-all duration-300 hover:scale-105 shadow-2xl"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>회의방 생성하기</span>
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              </Link>
              
              <Link 
                to="/join" 
                className="group px-12 py-5 border-2 border-white/20 rounded-2xl text-xl font-bold hover:border-white/40 transition-all duration-300 hover:scale-105 backdrop-blur-sm bg-white/5"
              >
                <div className="flex items-center space-x-3">
                  <Play className="w-5 h-5" />
                  <span>회의 참여하기</span>
                </div>
              </Link>
            </div>
          </div>

          {/* 특징 섹션 - Glassmorphism 카드 */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {[
              {
                icon: Mic,
                title: "개별 녹음",
                description: "각 참여자가 자신의 음성만 개별로 녹음하여 고품질 회의록을 생성합니다.",
                gradient: "from-purple-500 to-pink-500",
                bgGradient: "from-purple-500/10 to-pink-500/10"
              },
              {
                icon: Zap,
                title: "실시간 제어",
                description: "회의 진행자가 모든 참여자의 녹음을 중앙에서 통제할 수 있습니다.",
                gradient: "from-blue-500 to-cyan-500",
                bgGradient: "from-blue-500/10 to-cyan-500/10"
              },
              {
                icon: Globe,
                title: "브라우저 기반",
                description: "설치 없이 웹 브라우저만으로 어디서나 쉽게 사용할 수 있습니다.",
                gradient: "from-emerald-500 to-teal-500",
                bgGradient: "from-emerald-500/10 to-teal-500/10"
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-500 hover:scale-105 hover:border-white/20"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.bgGradient} rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                
                <div className="relative z-10">
                  <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-4 group-hover:text-white transition-colors">
                    {feature.title}
                  </h3>
                  
                  <p className="text-gray-300 leading-relaxed group-hover:text-gray-200 transition-colors">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA 섹션 - 강화된 Glassmorphism */}
          <div className="text-center">
            <div className="relative backdrop-blur-2xl bg-gradient-to-r from-white/10 to-white/5 border border-white/20 rounded-3xl p-12 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-emerald-500/10 rounded-3xl"></div>
              
              <div className="relative z-10">
                <h3 className="text-4xl font-black mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  지금 바로 시작하세요
                </h3>
                
                <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                  회의방을 생성하고 참여자들을 초대하여 
                  <span className="text-white font-semibold"> 혁신적인 회의 녹음</span>을 경험해보세요.
                </p>
                
                <Link 
                  to="/create" 
                  className="inline-flex items-center space-x-3 px-10 py-4 bg-gradient-to-r from-white to-gray-100 text-slate-900 rounded-2xl text-lg font-bold hover:from-gray-100 hover:to-white transition-all duration-300 hover:scale-105 shadow-xl"
                >
                  <Shield className="w-6 h-6" />
                  <span>무료로 시작하기</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 - 심플한 Glassmorphism */}
      <footer className="relative z-10 p-6 mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center">
            <p className="text-gray-400">
              &copy; 2025 conRec. 혁신적인 회의 녹음 플랫폼. 
              <span className="text-purple-400 ml-2">Made with ❤️ in Seoul</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default HomePage