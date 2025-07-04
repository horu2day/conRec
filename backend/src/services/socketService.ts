import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Room } from '../models/Room';
import { storageService } from '../storage/storageService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { RecordingStatus } from '../types/index';

interface ParticipantData {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: Date;
  socketId: string;
  recordingStatus: 'idle' | 'recording' | 'paused' | 'stopped';
}

function mapToStorageStatus(status: ParticipantData['recordingStatus']): RecordingStatus {
  switch (status) {
    case 'idle': return 'idle';
    case 'recording': return 'recording';
    case 'paused': case 'stopped': return 'completed';
    default: return 'idle';
  }
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
  private io: SocketIOServer | null = null;
  private rooms: Map<string, RoomData> = new Map();
  private userSocketMap: Map<string, string> = new Map();

  public initialize(server: HTTPServer): void {
    if (this.io) {
      logger.warn('Socket.io service is already initialized.');
      return;
    }

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8,
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    logger.info('Socket.io service initialized successfully.');
  }

  private setupEventHandlers(): void {
    if (!this.io) {
      logger.error('Socket.io is not initialized. Cannot set up event handlers.');
      return;
    }

    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);

      socket.on('create-room', async (data: { hostName: string }, callback) => {
        if (!this.io) return;
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
          socket.join(roomId);

          try {
            await storageService.createRoom({
              id: roomId,
              hostId,
              participants: [{
                id: hostId,
                name: data.hostName,
                isHost: true,
                joinedAt: new Date(),
                microphoneEnabled: true,
                recordingStatus: 'idle'
              }],
              status: 'waiting',
              createdAt: new Date(),
              maxParticipants: 10
            });
            logger.info(`Room saved to Storage Service: ${roomId}`);
          } catch (storageError) {
            logger.warn('Failed to save room to Storage Service (continuing):', storageError);
          }

          logger.info(`Room created: ${roomId}, Host: ${data.hostName}`);
          callback({
            success: true,
            data: {
              roomId,
              hostId,
              room: this.getRoomInfo(roomId)
            }
          });
        } catch (error) {
          logger.error('Failed to create room:', error);
          callback({ success: false, error: 'Failed to create room.' });
        }
      });

      socket.on('join-room', async (data: { roomId: string; userName: string }, callback) => {
        if (!this.io) return;
        try {
          let room = this.rooms.get(data.roomId);
          if (!room) {
            try {
              const storageRoom = await storageService.findRoomById(data.roomId);
              if (storageRoom && storageRoom.status !== 'ended') {
                room = {
                  id: storageRoom.id,
                  hostId: storageRoom.hostId,
                  participants: new Map(),
                  status: storageRoom.status as 'waiting' | 'recording' | 'paused' | 'ended',
                  createdAt: storageRoom.createdAt,
                  recordingDuration: 0
                };
                this.rooms.set(data.roomId, room);
                logger.info(`Room restored from Storage Service: ${data.roomId}`);
              }
            } catch (storageError) {
              logger.error('Failed to query Storage Service:', storageError);
            }
          }
          
          if (!room) {
            return callback({ success: false, error: 'Room not found.' });
          }
          if (room.participants.size >= 10) {
            return callback({ success: false, error: 'Room is full.' });
          }
          if (room.status === 'ended') {
            return callback({ success: false, error: 'Meeting has ended.' });
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
          socket.join(data.roomId);
          
          try {
            await storageService.updateRoom(data.roomId, {
              participants: Array.from(room.participants.values()).map(p => ({
                id: p.id, name: p.name, isHost: p.isHost, joinedAt: p.joinedAt,
                microphoneEnabled: true, recordingStatus: mapToStorageStatus(p.recordingStatus)
              }))
            });
            logger.info(`Participant added to Storage Service: ${data.userName} -> ${data.roomId}`);
          } catch (storageError) {
            logger.warn('Failed to add participant to Storage Service (continuing):', storageError);
          }

          socket.to(data.roomId).emit('participant-joined', {
            participant: this.sanitizeParticipant(participant),
            roomInfo: this.getRoomInfo(data.roomId)
          });
          logger.info(`Participant joined: ${data.roomId}, User: ${data.userName}`);
          callback({
            success: true,
            data: {
              participantId,
              room: this.getRoomInfo(data.roomId)
            }
          });
        } catch (error) {
          logger.error('Failed to join room:', error);
          callback({ success: false, error: 'Failed to join room.' });
        }
      });

      socket.on('start-recording', async (data: { roomId: string; hostId: string }, callback) => {
        if (!this.io) return;
        const room = this.rooms.get(data.roomId);
        if (!room || room.hostId !== data.hostId) {
          return callback({ success: false, error: 'Permission denied.' });
        }
        if (room.status === 'recording') {
          return callback({ success: false, error: 'Recording is already in progress.' });
        }
        room.status = 'recording';
        room.recordingStartTime = new Date();
        room.participants.forEach(p => p.recordingStatus = 'recording');
        this.io.to(data.roomId).emit('recording-started', {
          timestamp: room.recordingStartTime,
          roomInfo: this.getRoomInfo(data.roomId)
        });
        logger.info(`Recording started: ${data.roomId}`);
        callback({ success: true, data: { timestamp: room.recordingStartTime } });
      });

      socket.on('stop-recording', async (data: { roomId: string; hostId: string }, callback) => {
        if (!this.io) return;
        const room = this.rooms.get(data.roomId);
        if (!room || room.hostId !== data.hostId) {
          return callback({ success: false, error: 'Permission denied.' });
        }
        if (room.status !== 'recording') {
          return callback({ success: false, error: 'Not recording.' });
        }
        const endTime = new Date();
        if (room.recordingStartTime) {
          room.recordingDuration += endTime.getTime() - room.recordingStartTime.getTime();
        }
        room.status = 'waiting';
        room.recordingStartTime = undefined;
        room.participants.forEach(p => p.recordingStatus = 'stopped');
        this.io.to(data.roomId).emit('recording-stopped', {
          timestamp: endTime,
          duration: room.recordingDuration,
          roomInfo: this.getRoomInfo(data.roomId)
        });
        logger.info(`Recording stopped: ${data.roomId}, Duration: ${room.recordingDuration}ms`);
        callback({ success: true, data: { timestamp: endTime, duration: room.recordingDuration } });
      });

      socket.on('leave-room', (data: { roomId: string; participantId: string }) => {
        this.handleParticipantLeave(data.roomId, data.participantId, socket.id);
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.handleSocketDisconnect(socket.id);
      });

      socket.on('heartbeat', () => {
        socket.emit('heartbeat-response', { timestamp: new Date() });
      });
    });
  }

  private handleParticipantLeave(roomId: string, participantId: string, socketId: string): void {
    if (!this.io) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    const participant = room.participants.get(participantId);
    if (!participant) return;

    room.participants.delete(participantId);
    this.userSocketMap.delete(participantId);

    this.io.to(roomId).emit('participant-left', {
      participantId,
      participantName: participant.name,
      roomInfo: this.getRoomInfo(roomId)
    });

    if (participant.isHost) {
      this.endRoom(roomId);
    } else if (room.participants.size === 0) {
      this.rooms.delete(roomId);
    }
    logger.info(`Participant left: ${roomId}, ${participant.name}`);
  }

  private handleSocketDisconnect(socketId: string): void {
    for (const [userId, userSocketId] of this.userSocketMap.entries()) {
      if (userSocketId === socketId) {
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
    if (!this.io) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.status = 'ended';
    this.io.to(roomId).emit('room-ended', {
      timestamp: new Date(),
      totalDuration: room.recordingDuration
    });
    setTimeout(() => {
      this.rooms.delete(roomId);
      logger.info(`Room cleaned up: ${roomId}`);
    }, 5000);
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

  public getRooms() {
    return Array.from(this.rooms.values()).map(room => this.getRoomInfo(room.id));
  }

  public getRoom(roomId: string) {
    return this.getRoomInfo(roomId);
  }
}

const socketService = new SocketService();

export { socketService };
export type { ParticipantData, RoomData };