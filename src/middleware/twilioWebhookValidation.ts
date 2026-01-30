import { Request, Response, NextFunction } from 'express';
import { validateRequest } from 'twilio';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * Middleware to validate Twilio webhook signatures
 *
 * Verifies that incoming webhook requests are actually from Twilio by checking
 * the X-Twilio-Signature header against the expected signature computed from
 * the request URL and parameters.
 *
 * This prevents malicious actors from sending fake webhook requests.
 *
 * Can be disabled for local development by setting DISABLE_WEBHOOK_VALIDATION=true
 */

export function twilioWebhookValidation(req: Request, res: Response, next: NextFunction): void {
  // Skip validation if explicitly disabled (useful for local development)
  if (process.env.DISABLE_WEBHOOK_VALIDATION === 'true') {
    logger.debug('Webhook validation disabled by environment variable');
    return next();
  }

  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    logger.warn('Missing Twilio signature header', {
      requestId: req.requestId,
      path: req.path,
      ip: req.ip
    });
    res.status(403).json({ error: 'Missing webhook signature' });
    return;
  }

  // Construct the full URL
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${protocol}://${host}${req.originalUrl}`;

  // Get the POST parameters (Twilio sends data in req.body)
  const params = req.body;

  // Validate the request
  const isValid = validateRequest(
    config.twilio.authToken,
    signature,
    url,
    params
  );

  if (!isValid) {
    logger.warn('Invalid Twilio webhook signature', {
      requestId: req.requestId,
      path: req.path,
      url,
      ip: req.ip
    });
    res.status(403).json({ error: 'Invalid webhook signature' });
    return;
  }

  logger.debug('Twilio webhook signature validated', {
    requestId: req.requestId,
    path: req.path
  });

  next();
}
