import { httpServer } from './app';
import { config } from './config/index';
import { logger } from './utils/logger';
import { ensureDirectoryExists } from './utils/helpers';
import { socketService } from './services/socketService'; // Import socketService

// 서버 시작 함수
const startServer = async (): Promise<void> => {
  try {
    // ... (rest of the try block remains the same)
    
    // 서버 시작
    httpServer.listen(config.PORT, () => {
      logger.info(`🚀 Server is running on port ${config.PORT}`);
      logger.info(`📝 Environment: ${config.NODE_ENV}`);
      logger.info(`📁 Upload directory: ${config.UPLOAD_DIR}`);
      logger.info(`🔗 CORS origin: ${config.CORS_ORIGIN}`);
      
      if (config.isDevelopment) {
        logger.info(`🌐 Server URL: http://localhost:${config.PORT}`);
        logger.info(`🔍 Health check: http://localhost:${config.PORT}/health`);
      }
    });

    // ... (rest of the file remains the same)
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 서버 시작
startServer();

// ... (rest of the file remains the same)
