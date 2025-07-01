        : 0;
      
      room.participants.forEach(p => {
        p.recordingStatus = 'waiting';
      });
      
      console.log(`✅ 녹음 중지 성공: ${roomId} - 지속시간: ${Math.floor(duration/1000)}초`);
      
      callback({ 
        success: true, 
        data: { 
          timestamp: room.recordingEndedAt,
          duration: duration,
          roomInfo: room 
        } 
      });
      
      io.to(roomId).emit('recording-stopped', {
        stoppedAt: room.recordingEndedAt,
        stoppedBy: socket.id,
        duration: duration,
        roomInfo: room,
        timestamp: room.recordingEndedAt
      });
      
      console.log(`📢 모든 참여자에게 녹음 중지 신호 전송`);
      
    } catch (error) {
      console.error('❌ 녹음 중지 오류:', error);
      callback({ success: false, error: '녹음 중지에 실패했습니다.' });
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`클라이언트 연결 해제: ${socket.id}, 이유: ${reason}`);
    
    const participant = participants.get(socket.id);
    if (participant) {
      console.log(`📤 참여자 퇴장 처리: ${participant.name} (${socket.id})`);
      
      const room = rooms.get(participant.roomId);
      if (room) {
        const beforeCount = room.participants.length;
        room.participants = room.participants.filter(p => p.id !== socket.id);
        const afterCount = room.participants.length;
        
        console.log(`📊 참여자 수 변화: ${beforeCount} → ${afterCount}명`);
        
        socket.to(participant.roomId).emit('participant-left', {
          userId: socket.id,
          userName: participant.name,
          room: room,
          roomInfo: room
        });
        
        console.log(`📢 다른 참여자들에게 퇴장 알림 전송: ${participant.name}`);
        
        if (room.participants.length === 0) {
          rooms.delete(participant.roomId);
          console.log(`🗑️ 빈 회의방 삭제: ${participant.roomId}`);
        } else {
          const hasHost = room.participants.some(p => p.isHost);
          if (!hasHost && room.participants.length > 0) {
            room.participants[0].isHost = true;
            console.log(`👑 새로운 호스트 지정: ${room.participants[0].name}`);
          }
        }
      }
      
      participants.delete(socket.id);
    }
    
    console.log(`📊 현재 상태 - 활성 회의방: ${rooms.size}개, 전체 참여자: ${participants.size}명`);
  });
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
  console.error('Express 에러:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '파일 크기가 너무 큽니다. (최대 100MB)',
        code: 'FILE_TOO_LARGE'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: '파일 업로드 오류: ' + error.message,
      code: error.code
    });
  }
  
  res.status(500).json({
    success: false,
    message: '서버 내부 오류가 발생했습니다.',
    code: 'INTERNAL_ERROR'
  });
});

// 서버 시작
httpServer.listen(PORT, () => {
  console.log(`🚀 conRec Backend Server running on port ${PORT}`);
  console.log(`📝 Environment: development`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
  console.log('📊 회의방 현황:', rooms.size, '개');
  console.log('🎵 업로드 API 준비 완료');
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