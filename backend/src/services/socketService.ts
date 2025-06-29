/**
 * Socket.io 실시간 통신 서비스
 * 회의방 관리 및 실시간 제어 신호 처리
 * 
 * 연구 결과 적용:
 * - Socket.io 4.8.0 최신 버전 사용
 * - WebSocket + HTTP Long Polling 폴백
 * - 500ms 이내 응답 시간 목표
 * - 최대 10명 동시 접속 지원
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Room } from '../models/Room';
import { storageService } from '../storage/storageService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface ParticipantData {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: Date;
  socketId: string;
  recordingStatus: 'idle' | 'recording' | 'paused' | 'stopped';
}

interface RoomData {
  id: string;
  hostId: string;
  participants: Map<string, ParticipantData>;
  status: 'waiting' | 'recording' | 'paused' | 'ended';
  createdAt: Date;
  recordingStartTime?: Date;
  recordingDuration: number;
}

class SocketService {
  private io: SocketIOServer;
  private rooms: Map<string, RoomData> = new Map();
  private userSocketMap: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      // 성능 최적화 설정 (연구 결과 반영)
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8, // 100MB (오디오 파일 업로드용)
      transports: ['websocket', 'polling'], // WebSocket 우선, polling 폴백
    });

    this.setupEventHandlers();
    logger.info('Socket.io 서비스 초기화 완료');
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info(`클라이언트 연결: ${socket.id}`);

      // 회의방 생성
      socket.on('create-room', async (data: { hostName: string }, callback) => {
        try {
          const roomId = uuidv4();
          const hostId = uuidv4();
          
          const roomData: RoomData = {
            id: roomId,
            hostId,
            participants: new Map(),
            status: 'waiting',
            createdAt: new Date(),
            recordingDuration: 0
          };

          // 호스트를 참여자로 추가
          const hostParticipant: ParticipantData = {
            id: hostId,
            name: data.hostName,
            isHost: true,
            joinedAt: new Date(),
            socketId: socket.id,
            recordingStatus: 'idle'
          };

          roomData.participants.set(hostId, hostParticipant);
          this.rooms.set(roomId, roomData);
          this.userSocketMap.set(hostId, socket.id);

          // Socket을 룸에 조인
          socket.join(roomId);

          // Storage Service에 회의방 정보 저장
          try {
            const storageRoom = {
              id: roomId,
              hostId,
              participants: [{
                id: hostId,
                name: data.hostName,
                isHost: true,
                joinedAt: new Date(),
                microphoneEnabled: true,
                recordingStatus: 'idle' as const
              }],
              status: 'waiting' as const,
              createdAt: new Date(),
              maxParticipants: 10
            };
            await storageService.createRoom(storageRoom);
            logger.info(`Storage Service에 회의방 저장: ${roomId}`);
          } catch (storageError) {
            logger.warn('Storage Service 저장 실패 (계속 진행):', storageError);
          }

          logger.info(`회의방 생성: ${roomId}, 호스트: ${data.hostName}`);

          callback({
            success: true,
            data: {
              roomId,
              hostId,
              room: this.getRoomInfo(roomId)
            }
          });

        } catch (error) {
          logger.error('회의방 생성 실패:', error);
          callback({
            success: false,
            error: '회의방 생성에 실패했습니다.'
          });
        }
      });

      // 회의방 참여
      socket.on('join-room', async (data: { roomId: string; userName: string }, callback) => {
        try {
          let room = this.rooms.get(data.roomId);
          
          // 메모리에 방이 없으면 Storage Service에서 조회
          if (!room) {
            try {
              const storageRoom = await storageService.findRoomById(data.roomId);
              if (storageRoom && storageRoom.status !== 'ended') {
                // Storage Service에서 방을 찾았으면 메모리에 복원
                room = {
                  id: storageRoom.id,
                  hostId: storageRoom.hostId,
                  participants: new Map(),
                  status: storageRoom.status as 'waiting' | 'recording' | 'paused' | 'ended',
                  createdAt: storageRoom.createdAt,
                  recordingDuration: 0
                };
                
                // 기존 참여자들을 메모리에 복원 (단, 현재 연결된 소켓이 없으므로 스킵)
                this.rooms.set(data.roomId, room);
                logger.info(`Storage Service에서 회의방 복원: ${data.roomId}`);
              }
            } catch (storageError) {
              logger.error('Storage Service 조회 실패:', storageError);
            }
          }
          
          if (!room) {
            callback({
              success: false,
              error: '존재하지 않는 회의방입니다.'
            });
            return;
          }

          if (room.participants.size >= 10) {
            callback({
              success: false,
              error: '회의방이 가득 찼습니다. (최대 10명)'
            });
            return;
          }

          if (room.status === 'ended') {
            callback({
              success: false,
              error: '종료된 회의방입니다.'
            });
            return;
          }

          const participantId = uuidv4();
          const participant: ParticipantData = {
            id: participantId,
            name: data.userName,
            isHost: false,
            joinedAt: new Date(),
            socketId: socket.id,
            recordingStatus: 'idle'
          };

          room.participants.set(participantId, participant);
          this.userSocketMap.set(participantId, socket.id);

          // Socket을 룸에 조인
          socket.join(data.roomId);
          
          // Storage Service에도 참여자 추가
          try {
            await storageService.updateRoom(data.roomId, {
              participants: Array.from(room.participants.values()).map(p => ({
                id: p.id,
                name: p.name,
                isHost: p.isHost,
                joinedAt: p.joinedAt,
                microphoneEnabled: true,
                recordingStatus: p.recordingStatus
              }))
            });
            logger.info(`Storage Service에 참여자 추가: ${data.userName} -> ${data.roomId}`);
          } catch (storageError) {
            logger.warn('Storage Service 참여자 추가 실패 (계속 진행):', storageError);
          }

          // 다른 참여자들에게 새 참여자 알림
          socket.to(data.roomId).emit('participant-joined', {
            participant: this.sanitizeParticipant(participant),
            roomInfo: this.getRoomInfo(data.roomId)
          });

          logger.info(`회의방 참여: ${data.roomId}, 참여자: ${data.userName}`);

          callback({
            success: true,
            data: {
              participantId,
              room: this.getRoomInfo(data.roomId)
            }
          });

        } catch (error) {
          logger.error('회의방 참여 실패:', error);
          callback({
            success: false,
            error: '회의방 참여에 실패했습니다.'
          });
        }
      });

      // 녹음 시작 (호스트만 가능)
      socket.on('start-recording', async (data: { roomId: string; hostId: string }, callback) => {
        try {
          const room = this.rooms.get(data.roomId);
          
          if (!room || room.hostId !== data.hostId) {
            callback({
              success: false,
              error: '권한이 없습니다.'
            });
            return;
          }

          if (room.status === 'recording') {
            callback({
              success: false,
              error: '이미 녹음이 진행 중입니다.'
            });
            return;
          }

          // 방 상태 업데이트
          room.status = 'recording';
          room.recordingStartTime = new Date();

          // 모든 참여자의 녹음 상태 업데이트
          room.participants.forEach(participant => {
            participant.recordingStatus = 'recording';
          });

          // 모든 참여자에게 녹음 시작 신호 전송
          this.io.to(data.roomId).emit('recording-started', {
            timestamp: room.recordingStartTime,
            roomInfo: this.getRoomInfo(data.roomId)
          });

          logger.info(`녹음 시작: ${data.roomId}`);

          callback({
            success: true,
            data: {
              timestamp: room.recordingStartTime
            }
          });

        } catch (error) {
          logger.error('녹음 시작 실패:', error);
          callback({
            success: false,
            error: '녹음 시작에 실패했습니다.'
          });
        }
      });

      // 녹음 중지 (호스트만 가능)
      socket.on('stop-recording', async (data: { roomId: string; hostId: string }, callback) => {
        try {
          const room = this.rooms.get(data.roomId);
          
          if (!room || room.hostId !== data.hostId) {
            callback({
              success: false,
              error: '권한이 없습니다.'
            });
            return;
          }

          if (room.status !== 'recording') {
            callback({
              success: false,
              error: '녹음 중이 아닙니다.'
            });
            return;
          }

          // 녹음 시간 계산
          const endTime = new Date();
          if (room.recordingStartTime) {
            room.recordingDuration += endTime.getTime() - room.recordingStartTime.getTime();
          }

          // 방 상태 업데이트
          room.status = 'waiting';
          room.recordingStartTime = undefined;

          // 모든 참여자의 녹음 상태 업데이트
          room.participants.forEach(participant => {
            participant.recordingStatus = 'stopped';
          });

          // 모든 참여자에게 녹음 중지 신호 전송
          this.io.to(data.roomId).emit('recording-stopped', {
            timestamp: endTime,
            duration: room.recordingDuration,
            roomInfo: this.getRoomInfo(data.roomId)
          });

          logger.info(`녹음 중지: ${data.roomId}, 총 시간: ${room.recordingDuration}ms`);

          callback({
            success: true,
            data: {
              timestamp: endTime,
              duration: room.recordingDuration
            }
          });

        } catch (error) {
          logger.error('녹음 중지 실패:', error);
          callback({
            success: false,
            error: '녹음 중지에 실패했습니다.'
          });
        }
      });

      // 회의방 나가기
      socket.on('leave-room', (data: { roomId: string; participantId: string }) => {
        this.handleParticipantLeave(data.roomId, data.participantId, socket.id);
      });

      // 연결 해제 처리
      socket.on('disconnect', () => {
        logger.info(`클라이언트 연결 해제: ${socket.id}`);
        this.handleSocketDisconnect(socket.id);
      });

      // 하트비트 응답
      socket.on('heartbeat', () => {
        socket.emit('heartbeat-response', { timestamp: new Date() });
      });
    });
  }

  private handleParticipantLeave(roomId: string, participantId: string, socketId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(participantId);
    if (!participant) return;

    // 참여자 제거
    room.participants.delete(participantId);
    this.userSocketMap.delete(participantId);

    // 다른 참여자들에게 알림
    this.io.to(roomId).emit('participant-left', {
      participantId,
      participantName: participant.name,
      roomInfo: this.getRoomInfo(roomId)
    });

    // 호스트가 나간 경우 방 종료
    if (participant.isHost) {
      this.endRoom(roomId);
    }
    
    // 방이 비었으면 정리
    else if (room.participants.size === 0) {
      this.rooms.delete(roomId);
    }

    logger.info(`참여자 나감: ${roomId}, ${participant.name}`);
  }

  private handleSocketDisconnect(socketId: string): void {
    // 해당 소켓의 사용자 찾기
    for (const [userId, userSocketId] of this.userSocketMap.entries()) {
      if (userSocketId === socketId) {
        // 사용자가 속한 방 찾기
        for (const [roomId, room] of this.rooms.entries()) {
          if (room.participants.has(userId)) {
            this.handleParticipantLeave(roomId, userId, socketId);
            break;
          }
        }
        break;
      }
    }
  }

  private endRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'ended';

    // 모든 참여자에게 방 종료 알림
    this.io.to(roomId).emit('room-ended', {
      timestamp: new Date(),
      totalDuration: room.recordingDuration
    });

    // 방 정리
    setTimeout(() => {
      this.rooms.delete(roomId);
      logger.info(`회의방 정리: ${roomId}`);
    }, 5000); // 5초 후 정리
  }

  private getRoomInfo(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      hostId: room.hostId,
      status: room.status,
      participantCount: room.participants.size,
      participants: Array.from(room.participants.values()).map(p => this.sanitizeParticipant(p)),
      createdAt: room.createdAt,
      recordingDuration: room.recordingDuration,
      recordingStartTime: room.recordingStartTime
    };
  }

  private sanitizeParticipant(participant: ParticipantData) {
    return {
      id: participant.id,
      name: participant.name,
      isHost: participant.isHost,
      joinedAt: participant.joinedAt,
      recordingStatus: participant.recordingStatus
    };
  }

  // 방 목록 조회 (디버깅용)
  public getRooms() {
    const roomList = Array.from(this.rooms.values()).map(room => this.getRoomInfo(room.id));
    return roomList;
  }

  // 특정 방 정보 조회
  public getRoom(roomId: string) {
    return this.getRoomInfo(roomId);
  }
}

export { SocketService }
export type { ParticipantData, RoomData }
