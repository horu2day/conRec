/**
 * 업로드 테스트 및 디버깅 페이지
 * 업로드 실패 문제를 해결하기 위한 테스트 도구
 */

import React, { useState, useEffect } from 'react';
import { uploadService } from '../services/uploadService';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

const UploadDebugPage: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const addTestResult = (test: string, success: boolean, message: string, details?: any) => {
    const result: TestResult = {
      test,
      success,
      message,
      details,
      timestamp: new Date()
    };
    
    setTestResults(prev => [result, ...prev]);
    console.log(`테스트 결과 [${test}]:`, result);
  };

  const runConnectivityTest = async () => {
    try {
      addTestResult('연결 테스트', false, '시작 중...');
      
      const result = await uploadService.testConnection();
      addTestResult('연결 테스트', result.success, result.message, result.details);
      
    } catch (error) {
      addTestResult('연결 테스트', false, `예외 발생: ${error}`, { error });
    }
  };

  const runHealthCheck = async () => {
    try {
      addTestResult('헬스체크', false, '시작 중...');
      
      const result = await uploadService.checkHealth();
      addTestResult('헬스체크', result.healthy, result.message);
      
    } catch (error) {
      addTestResult('헬스체크', false, `예외 발생: ${error}`, { error });
    }
  };

  const createTestBlob = (): Blob => {
    // 간단한 테스트용 오디오 블롭 생성
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = audioContext.sampleRate;
    const duration = 2; // 2초
    const samples = sampleRate * duration;
    
    // 사인파 생성 (440Hz A음)
    const buffer = audioContext.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < samples; i++) {
      data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
    }
    
    // WAV 포맷으로 변환
    const wavBlob = bufferToWav(buffer);
    return wavBlob;
  };

  const bufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    const sampleRate = buffer.sampleRate;
    
    // WAV 헤더 작성
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // 오디오 데이터 작성
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const runTestUpload = async () => {
    try {
      addTestResult('테스트 업로드', false, '시작 중...');
      
      const testBlob = createTestBlob();
      addTestResult('테스트 블롭 생성', true, `크기: ${testBlob.size} bytes, 타입: ${testBlob.type}`);
      
      const result = await uploadService.uploadAudioFile(
        testBlob,
        'test-room-123',
        'test-participant-456',
        '테스트 참여자',
        2000, // 2초
        (progress) => {
          console.log('업로드 진행률:', progress);
        }
      );
      
      addTestResult('테스트 업로드', result.success, result.message, result.data);
      
    } catch (error) {
      addTestResult('테스트 업로드', false, `예외 발생: ${error}`, { error });
    }
  };

  const runFileUpload = async () => {
    if (!selectedFile) {
      addTestResult('파일 업로드', false, '파일이 선택되지 않았습니다.');
      return;
    }
    
    try {
      addTestResult('파일 업로드', false, '시작 중...');
      
      const result = await uploadService.uploadAudioFile(
        selectedFile,
        'test-room-789',
        'test-participant-012',
        '실제 파일 테스트',
        5000, // 5초
        (progress) => {
          console.log('파일 업로드 진행률:', progress);
        }
      );
      
      addTestResult('파일 업로드', result.success, result.message, result.data);
      
    } catch (error) {
      addTestResult('파일 업로드', false, `예외 발생: ${error}`, { error });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    addTestResult('전체 테스트', false, '시작됨');
    
    await runConnectivityTest();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runHealthCheck();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await runTestUpload();
    
    addTestResult('전체 테스트', true, '완료됨');
    setIsRunning(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      addTestResult('파일 선택', true, `${file.name} (${file.size} bytes, ${file.type})`);
    }
  };

  useEffect(() => {
    // 페이지 로드 시 기본 정보 수집
    addTestResult('브라우저 정보', true, `${navigator.userAgent}`);
    addTestResult('현재 URL', true, window.location.href);
    
    // 서비스 워커 확인
    if ('serviceWorker' in navigator) {
      addTestResult('Service Worker', true, '지원됨');
    } else {
      addTestResult('Service Worker', false, '지원되지 않음');
    }
    
    // HTTPS 확인
    if (window.location.protocol === 'https:') {
      addTestResult('HTTPS', true, '보안 연결');
    } else {
      addTestResult('HTTPS', false, 'HTTP 연결 (일부 기능 제한 가능)');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔧 업로드 디버깅 도구</h1>
        
        {/* 컨트롤 패널 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">테스트 실행</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <button
              onClick={runConnectivityTest}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              연결 테스트
            </button>
            
            <button
              onClick={runHealthCheck}
              disabled={isRunning}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              헬스체크
            </button>
            
            <button
              onClick={runTestUpload}
              disabled={isRunning}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              테스트 업로드
            </button>
            
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              {isRunning ? '실행 중...' : '전체 테스트'}
            </button>
          </div>
          
          {/* 파일 업로드 테스트 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">실제 파일 업로드 테스트:</label>
            <div className="flex gap-2">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="flex-1 text-white"
              />
              <button
                onClick={runFileUpload}
                disabled={!selectedFile || isRunning}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                파일 업로드
              </button>
            </div>
          </div>
          
          <button
            onClick={clearResults}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
          >
            결과 지우기
          </button>
        </div>
        
        {/* 테스트 결과 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">테스트 결과</h2>
          
          {testResults.length === 0 ? (
            <p className="text-gray-400">아직 테스트 결과가 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${
                    result.success 
                      ? 'bg-green-900/30 border-green-500' 
                      : 'bg-red-900/30 border-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                        {result.success ? '✅' : '❌'}
                      </span>
                      <span className="font-medium">{result.test}</span>
                      <span className="text-sm text-gray-400">
                        {result.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  
                  <p className="mt-1 text-sm">{result.message}</p>
                  
                  {result.details && (
                    <details className="mt-2">
                      <summary className="text-sm text-blue-400 cursor-pointer">상세 정보</summary>
                      <pre className="mt-1 text-xs bg-gray-700 p-2 rounded overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 사용법 안내 */}
        <div className="bg-gray-800 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">📖 사용법</h2>
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>연결 테스트:</strong> 백엔드 서버와의 기본 연결을 확인합니다.</p>
            <p><strong>헬스체크:</strong> 서버의 상태와 업로드 서비스 가용성을 확인합니다.</p>
            <p><strong>테스트 업로드:</strong> 자동 생성된 테스트 오디오 파일로 업로드를 테스트합니다.</p>
            <p><strong>파일 업로드:</strong> 실제 오디오 파일을 선택하여 업로드를 테스트합니다.</p>
            <p><strong>전체 테스트:</strong> 모든 테스트를 순차적으로 실행합니다.</p>
          </div>
        </div>

        {/* 진단 정보 */}
        <div className="bg-gray-800 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">🔍 진단 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">환경 정보</h3>
              <ul className="space-y-1 text-gray-300">
                <li>프론트엔드: {window.location.origin}</li>
                <li>백엔드: http://localhost:3000</li>
                <li>브라우저: {navigator.userAgent.split(') ')[0]})</li>
                <li>언어: {navigator.language}</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">기능 지원</h3>
              <ul className="space-y-1 text-gray-300">
                <li>Fetch API: {window.fetch ? '✅' : '❌'}</li>
                <li>FormData: {window.FormData ? '✅' : '❌'}</li>
                <li>File API: {window.File ? '✅' : '❌'}</li>
                <li>MediaDevices: {navigator.mediaDevices ? '✅' : '❌'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadDebugPage;
