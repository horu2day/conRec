import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import HomePage from './pages/HomePage'
import CreateMeetingPage from './pages/CreateMeetingPage'
import JoinMeetingPage from './pages/JoinMeetingPage'
import MeetingRoomPage from './pages/MeetingRoomPage'
import UploadDebugPage from './pages/UploadDebugPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-dark-bg text-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateMeetingPage />} />
          <Route path="/join" element={<JoinMeetingPage />} />
          <Route path="/join/:roomId" element={<JoinMeetingPage />} />
          <Route path="/meeting/:roomId" element={<MeetingRoomPage />} />
          <Route path="/debug" element={<UploadDebugPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        
        {/* 토스트 알림 */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#2d2d2d',
              color: '#ffffff',
              border: '1px solid #3d3d3d',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </div>
    </Router>
  )
}

export default App
