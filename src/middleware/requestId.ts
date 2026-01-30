import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request ID middleware for distributed tracing
 *
 * Adds a unique requestId to each incoming request.
 * If the request already has an X-Request-ID header, it uses that.
 * Otherwise, generates a new UUID.
 *
 * The requestId can be accessed in controllers via req.requestId
 */

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header, or generate new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Add to request object
  req.requestId = requestId;

  // Add to response headers for client-side tracing
  res.setHeader('X-Request-ID', requestId);

  next();
}
