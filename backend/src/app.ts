import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import roomRoutes from './routes/rooms';
import uploadRoutes from './routes/upload';
import { socketService } from './services/socketService';

const app = express();
const httpServer = http.createServer(app);

// Middleware
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));
app.use(helmet());
app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);

// Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO
socketService.initialize(httpServer);

export { app, httpServer };
