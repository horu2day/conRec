/**
 * 회의방 관리 컨트롤러 (Storage Service 사용)
 * MongoDB 없이도 in-memory storage로 동작
 */

import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { storageService } from '@/storage/storageService'
import { Room, User } from '@/types'
import { logger } from '@/utils/logger'

export class RoomController {
  /**
   * 회의방 생성
   * POST /api/rooms
   */
  public createRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { hostName, maxParticipants = 10 } = req.body

      if (!hostName || hostName.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: '진행자 이름이 필요합니다.'
        })
        return
      }

      // Room ID와 Host ID 생성
      const roomId = uuidv4()
      const hostId = uuidv4()

      // Host 사용자 생성
      const hostUser: User = {
        id: hostId,
        name: hostName.trim(),
        isHost: true,
        joinedAt: new Date(),
        microphoneEnabled: true,
        recordingStatus: 'idle'
      }

      // 회의방 생성
      const room: Room = {
        id: roomId,
        hostId,
        participants: [hostUser],
        status: 'waiting',
        createdAt: new Date(),
        maxParticipants: Math.min(Math.max(maxParticipants, 2), 50) // 2-50 제한
      }

      // 저장소에 저장
      const savedRoom = await storageService.createRoom(room)

      logger.info(`Room created: ${roomId} by ${hostName}`)

      res.status(201).json({
        success: true,
        message: '회의방이 성공적으로 생성되었습니다.',
        data: {
          room: savedRoom,
          hostUser,
          joinUrl: `${req.protocol}://${req.get('host')}/join/${roomId}`
        }
      })

    } catch (error) {
      logger.error('Room creation failed:', error)
      next(error)
    }
  }

  /**
   * 회의방 조회
   * GET /api/rooms/:roomId
   */
  public getRoomById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roomId } = req.params

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: '회의방 ID가 필요합니다.'
        })
        return
      }

      const room = await storageService.findRoomById(roomId)

      if (!room) {
        res.status(404).json({
          success: false,
          message: '회의방을 찾을 수 없습니다.'
        })
        return
      }

      logger.debug(`Room retrieved: ${roomId}`)

      res.status(200).json({
        success: true,
        message: '회의방 정보를 조회했습니다.',
        data: { room }
      })

    } catch (error) {
      logger.error('Room retrieval failed:', error)
      next(error)
    }
  }

  /**
   * 회의방 목록 조회
   * GET /api/rooms
   */
  public getAllRooms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rooms = await storageService.getAllRooms()

      res.status(200).json({
        success: true,
        message: '회의방 목록을 조회했습니다.',
        data: {
          totalRooms: rooms.length,
          rooms: rooms.map(room => ({
            id: room.id,
            hostId: room.hostId,
            participants: room.participants,
            status: room.status,
            createdAt: room.createdAt,
            maxParticipants: room.maxParticipants,
            participantCount: room.participants.length
          }))
        }
      })

    } catch (error) {
      logger.error('Room list retrieval failed:', error)
      next(error)
    }
  }

  /**
   * 회의방 참여
   * POST /api/rooms/:roomId/join
   */
  public joinRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roomId } = req.params
      const { userName } = req.body

      if (!roomId) {
        res.status(400).json({
          success: false,
          message: '회의방 ID가 필요합니다.'
        })
        return
      }

      if (!userName || userName.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: '참여자 이름이 필요합니다.'
        })
        return
      }

      const room = await storageService.findRoomById(roomId)

      if (!room) {
        res.status(404).json({
          success: false,
          message: '회의방을 찾을 수 없습니다.'
        })
        return
      }

      if (room.status === 'ended') {
        res.status(400).json({
          success: false,
          message: '종료된 회의방입니다.'
        })
        return
      }

      if (room.participants.length >= room.maxParticipants) {
        res.status(400).json({
          success: false,
          message: '회의방이 가득 찼습니다.'
        })
        return
      }

      // 새 참여자 생성
      const newUser: User = {
        id: uuidv4(),
        name: userName.trim(),
        isHost: false,
        joinedAt: new Date(),
        microphoneEnabled: true,
        recordingStatus: 'idle'
      }

      // 참여자 추가
      const updatedParticipants = [...room.participants, newUser]
      const updatedRoom = await storageService.updateRoom(roomId, {
        participants: updatedParticipants
      })

      if (!updatedRoom) {
        res.status(500).json({
          success: false,
          message: '회의방 참여에 실패했습니다.'
        })
        return
      }

      logger.info(`User joined room: ${userName} -> ${roomId}`)

      res.status(200).json({
        success: true,
        message: '회의방에 성공적으로 참여했습니다.',
        data: {
          room: updatedRoom,
          user: newUser
        }
      })

    } catch (error) {
      logger.error('Room join failed:', error)
      next(error)
    }
  }

  /**
   * 회의방 나가기
   * POST /api/rooms/:roomId/leave
   */
  public leaveRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roomId } = req.params
      const { userId } = req.body

      if (!roomId || !userId) {
        res.status(400).json({
          success: false,
          message: '회의방 ID와 사용자 ID가 필요합니다.'
        })
        return
      }

      const room = await storageService.findRoomById(roomId)

      if (!room) {
        res.status(404).json({
          success: false,
          message: '회의방을 찾을 수 없습니다.'
        })
        return
      }

      // 참여자 제거
      const updatedParticipants = room.participants.filter(p => p.id !== userId)
      
      // 호스트가 나간 경우 회의방 종료
      if (room.hostId === userId) {
        await storageService.updateRoom(roomId, {
          participants: updatedParticipants,
          status: 'ended'
        })
      } else {
        await storageService.updateRoom(roomId, {
          participants: updatedParticipants
        })
      }

      logger.info(`User left room: ${userId} -> ${roomId}`)

      res.status(200).json({
        success: true,
        message: '회의방에서 나갔습니다.'
      })

    } catch (error) {
      logger.error('Room leave failed:', error)
      next(error)
    }
  }

  /**
   * 회의 상태 변경 (녹음 시작/중지)
   * PUT /api/rooms/:roomId/status
   */
  public updateRoomStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roomId } = req.params
      const { status, hostId } = req.body

      if (!roomId || !status || !hostId) {
        res.status(400).json({
          success: false,
          message: '회의방 ID, 상태, 호스트 ID가 필요합니다.'
        })
        return
      }

      const room = await storageService.findRoomById(roomId)

      if (!room) {
        res.status(404).json({
          success: false,
          message: '회의방을 찾을 수 없습니다.'
        })
        return
      }

      // 호스트 권한 확인
      if (room.hostId !== hostId) {
        res.status(403).json({
          success: false,
          message: '호스트만 회의 상태를 변경할 수 있습니다.'
        })
        return
      }

      const updates: Partial<Room> = { status }

      // 녹음 시작 시간 기록
      if (status === 'recording') {
        updates.recordingStartedAt = new Date()
      }

      // 녹음 종료 시간 기록
      if (status === 'ended') {
        updates.recordingEndedAt = new Date()
      }

      const updatedRoom = await storageService.updateRoom(roomId, updates)

      logger.info(`Room status changed: ${roomId} -> ${status}`)

      res.status(200).json({
        success: true,
        message: '회의 상태가 변경되었습니다.',
        data: { room: updatedRoom }
      })

    } catch (error) {
      logger.error('Room status update failed:', error)
      next(error)
    }
  }

  /**
   * 저장소 상태 확인
   * GET /api/rooms/health
   */
  public getStorageHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const health = await storageService.checkHealth()

      res.status(health.status === 'healthy' ? 200 : 503).json({
        success: health.status === 'healthy',
        message: health.status === 'healthy' ? '저장소가 정상 작동 중입니다.' : '저장소에 문제가 있습니다.',
        data: health
      })

    } catch (error) {
      logger.error('Storage health check failed:', error)
      next(error)
    }
  }
}

export const roomController = new RoomController()
