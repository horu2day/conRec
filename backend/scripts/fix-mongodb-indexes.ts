#!/usr/bin/env ts-node

/**
 * MongoDB 인덱스 충돌 해결 스크립트
 * 
 * 문제: 같은 필드에 다른 옵션으로 중복 인덱스가 정의되어 인덱스 충돌 발생
 * 해결: 기존 인덱스를 삭제하고 새로운 인덱스를 생성
 */

import mongoose from 'mongoose'
import { config } from '../src/config'

const MONGODB_URI = config.MONGODB_URI || 'mongodb://localhost:27017/conrec'

async function fixIndexes() {
  try {
    console.log('🔧 MongoDB 인덱스 충돌 해결 중...')
    
    // MongoDB 연결
    await mongoose.connect(MONGODB_URI)
    console.log('✅ MongoDB 연결 성공')
    
    const db = mongoose.connection.db!
    
    // 1. Rooms 컬렉션 인덱스 정리
    console.log('\n📋 Rooms 컬렉션 인덱스 정리 중...')
    const roomsCollection = db.collection('rooms')
    
    try {
      // 기존 인덱스 목록 확인
      const roomIndexes = await roomsCollection.indexes()
      console.log('기존 인덱스:', roomIndexes.map(idx => idx.name))
      
      // 문제가 되는 인덱스 삭제 (충돌 인덱스만)
      const indexesToDrop = ['createdAt_1']
      
      for (const indexName of indexesToDrop) {
        try {
          await roomsCollection.dropIndex(indexName)
          console.log(`✅ 삭제됨: ${indexName}`)
        } catch (error: any) {
          if (error.code === 27) {
            console.log(`⚠️ 인덱스 없음: ${indexName}`)
          } else {
            console.log(`❌ 삭제 실패: ${indexName} - ${error.message}`)
          }
        }
      }
    } catch (error: any) {
      console.log(`⚠️ Rooms 컬렉션 처리 중 오류: ${error.message}`)
    }
    
    // 2. RecordingFiles 컬렉션 인덱스 정리
    console.log('\n📋 RecordingFiles 컬렉션 인덱스 정리 중...')
    const recordingFilesCollection = db.collection('recordingfiles')
    
    try {
      // 기존 인덱스 목록 확인
      const recordingIndexes = await recordingFilesCollection.indexes()
      console.log('기존 인덱스:', recordingIndexes.map(idx => idx.name))
      
      // 문제가 되는 인덱스 삭제 (충돌 인덱스만)
      const indexesToDrop = ['uploadedAt_1']
      
      for (const indexName of indexesToDrop) {
        try {
          await recordingFilesCollection.dropIndex(indexName)
          console.log(`✅ 삭제됨: ${indexName}`)
        } catch (error: any) {
          if (error.code === 27) {
            console.log(`⚠️ 인덱스 없음: ${indexName}`)
          } else {
            console.log(`❌ 삭제 실패: ${indexName} - ${error.message}`)
          }
        }
      }
    } catch (error: any) {
      console.log(`⚠️ RecordingFiles 컬렉션 처리 중 오류: ${error.message}`)
    }
    
    // 3. 새로운 인덱스 생성 (모델 로드 없이 직접 생성)
    console.log('\n🔍 새로운 인덱스 생성 중...')
    
    try {
      // Rooms 컬렉션 인덱스
      await roomsCollection.createIndex({ id: 1 }, { unique: true, background: true })
      console.log('✅ rooms.id 인덱스 생성')
      
      await roomsCollection.createIndex({ hostId: 1 }, { background: true })
      console.log('✅ rooms.hostId 인덱스 생성')
      
      await roomsCollection.createIndex({ status: 1 }, { background: true })
      console.log('✅ rooms.status 인덱스 생성')
      
      await roomsCollection.createIndex({ createdAt: -1 }, { background: true })
      console.log('✅ rooms.createdAt 인덱스 생성')
      
      await roomsCollection.createIndex({ status: 1, createdAt: -1 }, { background: true })
      console.log('✅ rooms.status+createdAt 인덱스 생성')
      
      await roomsCollection.createIndex({ hostId: 1, createdAt: -1 }, { background: true })
      console.log('✅ rooms.hostId+createdAt 인덱스 생성')
      
      // TTL 인덱스 (24시간 후 자동 삭제)
      await roomsCollection.createIndex(
        { createdAt: 1 }, 
        { expireAfterSeconds: 86400, background: true, name: 'ttl_createdAt' }
      )
      console.log('✅ rooms.ttl_createdAt 인덱스 생성')
      
      // RecordingFiles 컬렉션 인덱스
      await recordingFilesCollection.createIndex({ roomId: 1 }, { background: true })
      console.log('✅ recordingfiles.roomId 인덱스 생성')
      
      await recordingFilesCollection.createIndex({ participantId: 1 }, { background: true })
      console.log('✅ recordingfiles.participantId 인덱스 생성')
      
      await recordingFilesCollection.createIndex({ roomId: 1, participantId: 1 }, { background: true })
      console.log('✅ recordingfiles.roomId+participantId 인덱스 생성')
      
      await recordingFilesCollection.createIndex({ roomId: 1, uploadedAt: -1 }, { background: true })
      console.log('✅ recordingfiles.roomId+uploadedAt 인덱스 생성')
      
      await recordingFilesCollection.createIndex({ participantId: 1, uploadedAt: -1 }, { background: true })
      console.log('✅ recordingfiles.participantId+uploadedAt 인덱스 생성')
      
      // TTL 인덱스 (30일 후 자동 삭제)
      await recordingFilesCollection.createIndex(
        { uploadedAt: 1 }, 
        { expireAfterSeconds: 2592000, background: true, name: 'ttl_uploadedAt' }
      )
      console.log('✅ recordingfiles.ttl_uploadedAt 인덱스 생성')
      
    } catch (error: any) {
      console.log(`❌ 인덱스 생성 중 오류: ${error.message}`)
    }
    
    // 4. 최종 인덱스 목록 확인
    console.log('\n📊 최종 인덱스 목록:')
    
    const finalRoomIndexes = await roomsCollection.indexes()
    console.log('\n✅ Rooms 컬렉션 인덱스:')
    finalRoomIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`)
    })
    
    const finalRecordingIndexes = await recordingFilesCollection.indexes()
    console.log('\n✅ RecordingFiles 컬렉션 인덱스:')
    finalRecordingIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`)
    })
    
    console.log('\n🎉 MongoDB 인덱스 충돌 해결 완료!')
    
  } catch (error) {
    console.error('❌ 인덱스 수정 중 오류 발생:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 MongoDB 연결 해제')
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  fixIndexes()
    .then(() => {
      console.log('✅ 스크립트 실행 완료')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error)
      process.exit(1)
    })
}

export { fixIndexes }
