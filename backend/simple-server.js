const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// 기본 설정
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5177"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// 업로드 디렉토리 생성
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 미들웨어
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5177"],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 메모리 기반 회의방 저장소
const rooms = new Map();
const participants = new Map();

// 회의방 생성 함수
function createRoom(hostId, hostName) {
  const roomId = require('uuid').v4();
  const room = {
    id: roomId,
    hostId,
    hostName,
    participants: [{
      id: hostId,
      name: hostName,
      isHost: true,
      joinedAt: new Date().toISOString(),
      microphoneEnabled: true,
      recordingStatus: 'waiting'
    }],
    status: 'waiting',
    createdAt: new Date().toISOString(),
    maxParticipants: 10
  };
  
  rooms.set(roomId, room);
  participants.set(hostId, { roomId, ...room.participants[0] });
  
  return { room, hostUser: room.participants[0] };
}

// 회의방 참여 함수
function joinRoom(roomId, userId, userName) {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '존재하지 않는 회의방입니다.' };
  }
  
  if (room.status === 'ended') {
    return { success: false, error: '종료된 회의방입니다.' };
  }
  
  if (room.participants.length >= room.maxParticipants) {
    return { success: false, error: '회의방이 가득 찼습니다.' };
  }
  
  // 이미 참여한 사용자인지 확인
  const existingParticipant = room.participants.find(p => p.id === userId);
  if (existingParticipant) {
    return { success: false, error: '이미 참여한 사용자입니다.' };
  }
  
  const newParticipant = {
    id: userId,
    name: userName,
    isHost: false,
    joinedAt: new Date().toISOString(),
    microphoneEnabled: true,
    recordingStatus: 'waiting'
  };
  
  room.participants.push(newParticipant);
  participants.set(userId, { roomId, ...newParticipant });
  
  return { success: true, room, user: newParticipant };
}

// 헬스체크 엔드포인트 (기본 라우트보다 먼저 정의)
app.get('/health', (req, res) => {
  console.log('Health check 요청 수신')
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: 'development',
    uptime: process.uptime(),
    rooms: rooms.size,
    participants: participants.size
  });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: 'conRec Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// 회의방 생성 API
app.post('/api/rooms', (req, res) => {
  try {
    const { hostName, maxParticipants = 10 } = req.body;
    
    if (!hostName) {
      return res.status(400).json({
        success: false,
        message: '진행자 이름이 필요합니다.'
      });
    }
    
    const hostId = require('uuid').v4();
    const result = createRoom(hostId, hostName);
    
    res.json({
      success: true,
      message: '회의방이 성공적으로 생성되었습니다.',
      data: {
        ...result,
        joinUrl: `http://localhost:5173/join/${result.room.id}`
      }
    });
    
    console.log(`회의방 생성: ${result.room.id} (호스트: ${hostName})`);
    
  } catch (error) {
    console.error('회의방 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '회의방 생성에 실패했습니다.'
    });
  }
});

// 회의방 정보 조회 API
app.get('/api/rooms/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: '존재하지 않는 회의방입니다.'
      });
    }
    
    res.json({
      success: true,
      message: '회의방 정보를 성공적으로 조회했습니다.',
      data: { room }
    });
    
  } catch (error) {
    console.error('회의방 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '회의방 정보 조회에 실패했습니다.'
    });
  }
});

// 회의방 참여 API
app.post('/api/rooms/:roomId/join', (req, res) => {
  try {
    const { roomId } = req.params;
    const { userName } = req.body;
    
    if (!userName) {
      return res.status(400).json({
        success: false,
        message: '사용자 이름이 필요합니다.'
      });
    }
    
    const userId = require('uuid').v4();
    const result = joinRoom(roomId, userId, userName);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
    
    res.json({
      success: true,
      message: '회의방에 성공적으로 참여했습니다.',
      data: result
    });
    
    console.log(`회의방 참여: ${roomId} (참여자: ${userName})`);
    
  } catch (error) {
    console.error('회의방 참여 오류:', error);
    res.status(500).json({
      success: false,
      message: '회의방 참여에 실패했습니다.'
    });
  }
});

// Socket.IO 이벤트 처리
io.on('connection', (socket) => {
  console.log(`클라이언트 연결됨: ${socket.id}`);
  
  socket.on('create-room', async (data, callback) => {
    try {
      const { hostName, maxParticipants = 10 } = data;
      console.log(`회의방 생성 요청: 호스트명=${hostName}, 소켓ID=${socket.id}, maxParticipants=${maxParticipants}`);
      
      if (!hostName) {
        console.log('❌ 회의방 생성 실패: 호스트 이름 없음');
        return callback({ success: false, error: '진행자 이름이 필요합니다.' });
      }
      
      const hostId = socket.id;
      const result = createRoom(hostId, hostName);
      
      // 소켓을 회의방에 조인
      await socket.join(result.room.id);
      
      console.log(`✅ 소켓 회의방 생성 성공: ${result.room.id} (호스트: ${hostName})`);
      console.log(`📊 회의방 정보:`, {
        roomId: result.room.id,
        hostId: hostId,
        participantCount: result.room.participants.length
      });
      
      // 프론트엔드가 기대하는 구조로 응답
      callback({
        success: true,
        roomId: result.room.id,
        data: {
          roomId: result.room.id,
          hostId: hostId,
          room: result.room,
          hostUser: result.hostUser,
          joinUrl: `http://localhost:5177/join/${result.room.id}` // 포트 수정
        }
      });
      
      console.log(`🔗 생성된 초대 링크: http://localhost:5177/join/${result.room.id}`);
      
    } catch (error) {
      console.error('❌ 소켓 회의방 생성 오류:', error);
      callback({ success: false, error: '회의방 생성에 실패했습니다.' });
    }
  });
  
  socket.on('join-room', async (data, callback) => {
    try {
      const { roomId, userName } = data;
      console.log(`회의방 참여 요청: 방ID=${roomId}, 사용자명=${userName}, 소켓ID=${socket.id}`);
      
      if (!roomId || !userName) {
        console.log('❌ 회의방 참여 실패: 필수 정보 누락');
        return callback({ success: false, error: '회의방 ID와 사용자 이름이 필요합니다.' });
      }
      
      const userId = socket.id;
      const result = joinRoom(roomId, userId, userName);
      
      if (!result.success) {
        console.log(`❌ 회의방 참여 실패: ${result.error}`);
        return callback({ success: false, error: result.error });
      }
      
      // 소켓을 회의방에 조인
      await socket.join(roomId);
      
      console.log(`✅ 소켓 회의방 참여 성공: ${roomId} (참여자: ${userName})`);
      console.log(`📊 현재 방 참여자 수: ${result.room.participants.length}명`);
      
      // 다른 참여자들에게 새 참여자 알림 (자신 제외)
      socket.to(roomId).emit('participant-joined', {
        participant: result.user,
        roomInfo: result.room
      });
      
      console.log(`📢 다른 참여자들에게 입장 알림 전송: ${userName}`);
      
      // 참여자에게 성공 응답
      callback({
        success: true,
        data: {
          participantId: userId,
          room: result.room
        }
      });
      
    } catch (error) {
      console.error('❌ 소켓 회의방 참여 오류:', error);
      callback({ success: false, error: '회의방 참여에 실패했습니다.' });
    }
  });
  
  socket.on('start-recording', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    
    if (room) {
      room.status = 'recording';
      room.recordingStartedAt = new Date().toISOString();
      
      // 모든 참여자의 녹음 상태 업데이트
      room.participants.forEach(p => {
        p.recordingStatus = 'recording';
      });
      
      // 회의방의 모든 참여자에게 녹음 시작 신호
      io.to(roomId).emit('recording-started', {
        startedAt: room.recordingStartedAt,
        startedBy: socket.id
      });
      
      console.log(`녹음 시작: ${roomId}`);
    }
  });
  
  socket.on('stop-recording', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    
    if (room) {
      room.status = 'waiting';
      room.recordingEndedAt = new Date().toISOString();
      
      // 모든 참여자의 녹음 상태 업데이트
      room.participants.forEach(p => {
        p.recordingStatus = 'waiting';
      });
      
      // 회의방의 모든 참여자에게 녹음 중지 신호
      io.to(roomId).emit('recording-stopped', {
        stoppedAt: room.recordingEndedAt,
        stoppedBy: socket.id
      });
      
      console.log(`녹음 중지: ${roomId}`);
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`클라이언트 연결 해제: ${socket.id}, 이유: ${reason}`);
    
    // 참여자 정보 정리
    const participant = participants.get(socket.id);
    if (participant) {
      console.log(`📤 참여자 퇴장 처리: ${participant.name} (${socket.id})`);
      
      const room = rooms.get(participant.roomId);
      if (room) {
        // 참여자 목록에서 제거
        const beforeCount = room.participants.length;
        room.participants = room.participants.filter(p => p.id !== socket.id);
        const afterCount = room.participants.length;
        
        console.log(`📊 참여자 수 변화: ${beforeCount} → ${afterCount}명`);
        
        // 다른 참여자들에게 알림
        socket.to(participant.roomId).emit('participant-left', {
          userId: socket.id,
          userName: participant.name,
          roomInfo: room
        });
        
        console.log(`📢 다른 참여자들에게 퇴장 알림 전송: ${participant.name}`);
        
        // 방이 비어있으면 삭제
        if (room.participants.length === 0) {
          rooms.delete(participant.roomId);
          console.log(`🗑️ 빈 회의방 삭제: ${participant.roomId}`);
        } else {
          // 호스트가 나간 경우 다른 참여자를 호스트로 지정
          const hasHost = room.participants.some(p => p.isHost);
          if (!hasHost && room.participants.length > 0) {
            room.participants[0].isHost = true;
            console.log(`👑 새로운 호스트 지정: ${room.participants[0].name}`);
          }
        }
      }
      
      participants.delete(socket.id);
    } else {
      console.log(`⚠️ 연결 해제된 소켓의 참여자 정보 없음: ${socket.id}`);
    }
    
    console.log(`📊 현재 상태 - 활성 회의방: ${rooms.size}개, 전체 참여자: ${participants.size}명`);
  });
});

// 서버 시작
httpServer.listen(PORT, () => {
  console.log(`🚀 conRec Backend Server running on port ${PORT}`);
  console.log(`📝 Environment: development`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log('📊 회의방 현황:', rooms.size, '개');
});

// 에러 처리
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
