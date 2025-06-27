import mongoose, { Schema, Document } from 'mongoose'
import { RecordingFile as IRecordingFileType, TranscriptionResult } from '@/types'

// Mongoose Document 인터페이스
export interface RecordingFileDocument extends IRecordingFileType, Document {
  _id: string
}

// 전사 결과 서브스키마
const transcriptionSegmentSchema = new Schema({
  start: { type: Number, required: true },
  end: { type: Number, required: true },
  text: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 }
}, { _id: false })

const transcriptionResultSchema = new Schema({
  text: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  language: { type: String },
  segments: [transcriptionSegmentSchema],
  processedAt: { type: Date, required: true }
}, { _id: false })

// 녹음 파일 스키마 정의
const recordingFileSchema = new Schema<RecordingFileDocument>({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  roomId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true,
    enum: ['audio/wav', 'audio/webm', 'audio/mp3', 'audio/ogg', 'audio/m4a', 'audio/mpeg']
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number, // 초 단위
    min: 0
  },
  filePath: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  transcription: {
    type: transcriptionResultSchema
  }
}, {
  timestamps: true,
  versionKey: false
})

// 복합 인덱스
recordingFileSchema.index({ roomId: 1, userId: 1 })
recordingFileSchema.index({ roomId: 1, uploadedAt: -1 })
recordingFileSchema.index({ userId: 1, uploadedAt: -1 })

// TTL 인덱스 (30일 후 자동 삭제)
recordingFileSchema.index({ uploadedAt: 1 }, { expireAfterSeconds: 2592000 })

// 스키마 메서드
recordingFileSchema.methods.addTranscription = function(transcription: TranscriptionResult) {
  this.transcription = transcription
  return this.save()
}

recordingFileSchema.methods.hasTranscription = function(): boolean {
  return !!this.transcription
}

recordingFileSchema.methods.getFileExtension = function(): string {
  const mimeToExt: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/m4a': 'm4a'
  }
  
  return mimeToExt[this.mimeType] || 'audio'
}

recordingFileSchema.methods.getFormattedSize = function(): string {
  const bytes = this.size
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

recordingFileSchema.methods.getFormattedDuration = function(): string {
  if (!this.duration) return 'Unknown'
  
  const seconds = this.duration
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

// 스태틱 메서드
recordingFileSchema.statics.findByRoomId = function(roomId: string) {
  return this.find({ roomId }).sort({ uploadedAt: 1 })
}

recordingFileSchema.statics.findByUserId = function(userId: string) {
  return this.find({ userId }).sort({ uploadedAt: -1 })
}

recordingFileSchema.statics.findByRoomAndUser = function(roomId: string, userId: string) {
  return this.findOne({ roomId, userId })
}

recordingFileSchema.statics.findPendingTranscription = function() {
  return this.find({ transcription: { $exists: false } }).sort({ uploadedAt: 1 })
}

recordingFileSchema.statics.findWithTranscription = function(roomId?: string) {
  const query = { transcription: { $exists: true } }
  if (roomId) {
    Object.assign(query, { roomId })
  }
  return this.find(query).sort({ uploadedAt: 1 })
}

recordingFileSchema.statics.getTotalSize = function(roomId?: string) {
  const match = roomId ? { roomId } : {}
  return this.aggregate([
    { $match: match },
    { $group: { _id: null, totalSize: { $sum: '$size' } } }
  ])
}

recordingFileSchema.statics.getStatsByRoom = function(roomId: string) {
  return this.aggregate([
    { $match: { roomId } },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        totalDuration: { $sum: '$duration' },
        transcribedFiles: {
          $sum: { $cond: [{ $exists: ['$transcription', true] }, 1, 0] }
        }
      }
    }
  ])
}

// 가상 필드
recordingFileSchema.virtual('isTranscribed').get(function() {
  return !!this.transcription
})

recordingFileSchema.virtual('fileExtension').get(function() {
  return this.getFileExtension()
})

recordingFileSchema.virtual('formattedSize').get(function() {
  return this.getFormattedSize()
})

recordingFileSchema.virtual('formattedDuration').get(function() {
  return this.getFormattedDuration()
})

// JSON 변환 시 _id 제거 및 가상 필드 포함
recordingFileSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret._id
    delete ret.__v
    return ret
  }
})

// 모델 생성 및 export
export const RecordingFile = mongoose.model<RecordingFileDocument>('RecordingFile', recordingFileSchema)

// 타입 export
export type { RecordingFileDocument }
