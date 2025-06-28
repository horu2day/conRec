import mongoose, { Schema, Document } from 'mongoose'
import { RecordingFile as IRecordingFileType, TranscriptionResult } from '@/types'

// Mongoose Document 인터페이스 (id 속성 제거)
export interface RecordingFileDocument extends Omit<IRecordingFileType, 'id'>, Document {
  _id: string
  
  // 메서드 정의
  addTranscription(transcription: TranscriptionResult): Promise<this>
  hasTranscription(): boolean
  getFileExtension(): string
  getFormattedSize(): string
  getFormattedDuration(): string
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
  roomId: {
    type: String,
    required: true,
    index: true
  },
  participantId: {
    type: String,
    required: true,
    index: true
  },
  participantName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String
  },
  mimeType: {
    type: String,
    required: true,
    enum: ['audio/wav', 'audio/webm', 'audio/mp3', 'audio/ogg', 'audio/m4a', 'audio/mpeg']
  },
  fileSize: {
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
    default: Date.now
  },
  gridFSId: {
    type: mongoose.Schema.Types.ObjectId
  },
  transcription: {
    type: transcriptionResultSchema
  }
}, {
  timestamps: true,
  versionKey: false
})

// 복합 인덱스
recordingFileSchema.index({ roomId: 1, participantId: 1 })
recordingFileSchema.index({ roomId: 1, uploadedAt: -1 })
recordingFileSchema.index({ participantId: 1, uploadedAt: -1 })

// TTL 인덱스 (30일 후 자동 삭제)
recordingFileSchema.index({ uploadedAt: 1 }, { expireAfterSeconds: 2592000, name: 'ttl_uploadedAt' })

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
  const bytes = this.fileSize
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

recordingFileSchema.statics.findByParticipantId = function(participantId: string) {
  return this.find({ participantId }).sort({ uploadedAt: -1 })
}

recordingFileSchema.statics.findByRoomAndParticipant = function(roomId: string, participantId: string) {
  return this.findOne({ roomId, participantId })
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
    { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
  ])
}

recordingFileSchema.statics.getStatsByRoom = function(roomId: string) {
  return this.aggregate([
    { $match: { roomId } },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        totalDuration: { $sum: '$duration' },
        transcribedFiles: {
          $sum: { $cond: [{ $exists: ['$transcription', true] }, 1, 0] }
        }
      }
    }
  ])
}

// JSON 변환 시 _id 제거
recordingFileSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id // _id를 id로 변환
    delete ret._id
    delete ret.__v
    return ret
  }
})

// 모델 생성 및 export
export const RecordingFile = mongoose.model<RecordingFileDocument>('RecordingFile', recordingFileSchema)
