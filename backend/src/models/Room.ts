import mongoose, { Schema, Document } from 'mongoose'
import { Room as IRoomType, RoomStatus } from '@/types'

// Mongoose Document 인터페이스 (id 속성 제거)
export interface RoomDocument extends Omit<IRoomType, 'id'>, Document {
  _id: string
  id: string
}

// 회의방 스키마 정의
const roomSchema = new Schema<RoomDocument>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hostId: {
    type: String,
    required: true,
    index: true
  },
  participants: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    isHost: { type: Boolean, required: true },
    joinedAt: { type: Date, required: true },
    microphoneEnabled: { type: Boolean, default: true },
    recordingStatus: { 
      type: String, 
      enum: ['idle', 'recording', 'uploading', 'completed', 'error'],
      default: 'idle'
    },
    socketId: { type: String }
  }],
  status: {
    type: String,
    enum: ['waiting', 'recording', 'ended'] as RoomStatus[],
    default: 'waiting',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  recordingStartedAt: {
    type: Date
  },
  recordingEndedAt: {
    type: Date
  },
  maxParticipants: {
    type: Number,
    default: 10,
    min: 2,
    max: 50
  }
}, {
  timestamps: true,
  versionKey: false
})

// 인덱스 설정
roomSchema.index({ createdAt: -1 })
roomSchema.index({ status: 1, createdAt: -1 })
roomSchema.index({ hostId: 1, createdAt: -1 })

// TTL 인덱스 (24시간 후 자동 삭제)
roomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

// 스키마 메서드
roomSchema.methods.addParticipant = function(participant: IRoomType['participants'][0]) {
  // 중복 참여자 확인
  const existingIndex = this.participants.findIndex((p: any) => p.id === participant.id)
  
  if (existingIndex >= 0) {
    // 기존 참여자 업데이트
    this.participants[existingIndex] = participant
  } else {
    // 새 참여자 추가
    this.participants.push(participant)
  }
  
  return this.save()
}

roomSchema.methods.removeParticipant = function(participantId: string) {
  this.participants = this.participants.filter((p: any) => p.id !== participantId)
  return this.save()
}

roomSchema.methods.updateParticipantStatus = function(
  participantId: string, 
  updates: Partial<IRoomType['participants'][0]>
) {
  const participantIndex = this.participants.findIndex((p: any) => p.id === participantId)
  
  if (participantIndex >= 0) {
    Object.assign(this.participants[participantIndex], updates)
    return this.save()
  }
  
  throw new Error('Participant not found')
}

roomSchema.methods.isHost = function(userId: string): boolean {
  return this.hostId === userId
}

roomSchema.methods.isFull = function(): boolean {
  return this.participants.length >= this.maxParticipants
}

roomSchema.methods.canRecord = function(): boolean {
  return this.status === 'waiting' && this.participants.length > 0
}

roomSchema.methods.canStopRecording = function(): boolean {
  return this.status === 'recording'
}

// 스태틱 메서드
roomSchema.statics.findByRoomId = function(roomId: string) {
  return this.findOne({ id: roomId })
}

roomSchema.statics.findActiveRooms = function() {
  return this.find({ 
    status: { $in: ['waiting', 'recording'] } 
  }).sort({ createdAt: -1 })
}

roomSchema.statics.findByHostId = function(hostId: string) {
  return this.find({ hostId }).sort({ createdAt: -1 })
}

roomSchema.statics.findRecordingRooms = function() {
  return this.find({ status: 'recording' })
}

// JSON 변환 시 _id 제거
roomSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret._id
    delete ret.__v
    return ret
  }
})

// 모델 생성 및 export
export const Room = mongoose.model<RoomDocument>('Room', roomSchema)
