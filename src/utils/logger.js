const winston = require('winston');
const path = require('path');
const config = require('../config');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fasttrack-process-import' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file logging in production
if (config.nodeEnv === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(__dirname, '../../data/error.log'),
    level: 'error',
    maxsize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles
  }));
  
  logger.add(new winston.transports.File({
    filename: path.join(__dirname, '../../data/combined.log'),
    maxsize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles
  }));
}

module.exports = logger;
