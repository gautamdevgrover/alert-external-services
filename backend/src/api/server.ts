import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';
import { checkDbHealth } from '../db';

// Route handlers
import servicesRouter from './routes/services';
import alertsRouter from './routes/alerts';
import metricsRouter from './routes/metrics';
import historyRouter from './routes/history';
import thresholdsRouter from './routes/thresholds';
import monitoringRouter from './routes/monitoring';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: '*', // In production, restrict to frontend domain
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting (1000 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Request logging middleware (secrets are sanitized automatically)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
  });
  next();
});

// Health check endpoint (Section 20)
app.get('/health', async (req: Request, res: Response) => {
  const dbOk = await checkDbHealth();
  if (dbOk) {
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// API Routes
app.use('/api/services', servicesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/history', historyRouter);
app.use('/api/thresholds', thresholdsRouter);
app.use('/api/monitoring', monitoringRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled server error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
if (require.main === module) {
  const port = config.port;
  const server = app.listen(port, () => {
    logger.info(`CyberForce Monitoring API Server listening on port ${port} (env: ${config.nodeEnv})`);
  });

  const shutdown = () => {
    logger.info('Shutting down API server gracefully...');
    server.close(() => {
      logger.info('API server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;
