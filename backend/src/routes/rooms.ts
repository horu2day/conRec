/**
 * 회의방 관리 라우트
 */

import { Router } from 'express'
import { roomController } from '@/controllers/roomController'

const router = Router()

// 회의방 생성
router.post('/', roomController.createRoom)

// 회의방 조회
router.get('/:roomId', roomController.getRoomById)

// 회의방 목록 조회
router.get('/', roomController.getAllRooms)

// 회의방 참여
router.post('/:roomId/join', roomController.joinRoom)

// 회의방 나가기
router.post('/:roomId/leave', roomController.leaveRoom)

// 회의 상태 변경 (녹음 시작/중지)
router.put('/:roomId/status', roomController.updateRoomStatus)

// 저장소 상태 확인
router.get('/health', roomController.getStorageHealth)

export default router
