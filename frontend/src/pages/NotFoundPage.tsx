import { Link } from 'react-router-dom'
import { ArrowLeft, Home } from 'lucide-react'

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-6">
      <div className="max-w-md mx-auto text-center">
        {/* 404 숫자 */}
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-primary-500 mb-4">404</h1>
          <h2 className="text-2xl font-semibold mb-2">페이지를 찾을 수 없습니다</h2>
          <p className="text-gray-400">
            요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => window.history.back()}
            className="btn-secondary flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>이전 페이지</span>
          </button>
          
          <Link 
            to="/" 
            className="btn-primary flex items-center justify-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>홈으로 가기</span>
          </Link>
        </div>

        {/* 추가 링크 */}
        <div className="mt-8 pt-8 border-t border-dark-border">
          <p className="text-sm text-gray-400 mb-4">
            다음 페이지들을 이용해보세요:
          </p>
          <div className="flex flex-col space-y-2">
            <Link 
              to="/create" 
              className="text-primary-400 hover:text-primary-300 transition-colors"
            >
              회의방 생성하기
            </Link>
            <Link 
              to="/join" 
              className="text-primary-400 hover:text-primary-300 transition-colors"
            >
              회의 참여하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
