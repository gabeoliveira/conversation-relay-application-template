import express, { Request, Response } from 'express';

const router = express.Router();

/**
 * Health check endpoint for load balancers and monitoring systems
 * Returns 200 OK if the service is running
 */
router.get('/health', (req: Request, res: Response) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(200).json(healthCheck);
});

/**
 * Readiness check endpoint
 * Can be extended to check dependencies (database, Redis, etc.)
 */
router.get('/ready', (req: Request, res: Response) => {
  // For now, just check if the process is running
  // TODO: Add checks for external dependencies when implemented
  const readinessCheck = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      server: 'ok'
      // Add more checks as dependencies are added:
      // redis: 'ok',
      // database: 'ok'
    }
  };

  res.status(200).json(readinessCheck);
});

export default router;
