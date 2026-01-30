import winston from 'winston';

/**
 * Structured logger using Winston
 *
 * Log Levels:
 * - error: Error messages
 * - warn: Warning messages
 * - info: Informational messages (default)
 * - debug: Debug messages (verbose)
 *
 * Usage:
 *   logger.info('Message processed', { conversationSid, messageId });
 *   logger.error('Failed to send message', { error, conversationSid });
 */

const logLevel = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'conversation-relay',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport with color formatting for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;

          // Add metadata if present
          const metaKeys = Object.keys(metadata).filter(
            key => key !== 'service' && key !== 'environment' && key !== 'timestamp'
          );

          if (metaKeys.length > 0) {
            const metaObj: Record<string, any> = {};
            metaKeys.forEach(key => {
              metaObj[key] = metadata[key];
            });
            msg += ` ${JSON.stringify(metaObj)}`;
          }

          return msg;
        })
      )
    })
  ]
});

// If in production, add file transports
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json()
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json()
    })
  );
}

export default logger;
