require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // File upload settings
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedExtensions: ['.xlsx', '.xls', '.csv'],
    destination: 'data/uploads'
  },
  
  // Azure DevOps settings
  azureDevOps: {
    baseUrl: 'https://dev.azure.com',
    apiVersion: '7.1-preview.1',
    maxRetries: 3,
    retryDelay: 1000
  },
  
  // Microsoft repository settings
  microsoft: {
    repoUrl: 'https://github.com/microsoft/dynamics365patternspractices',
    catalogPath: 'business-process-catalog',
    branch: 'main'
  },
  
  // Process settings
  process: {
    maxConcurrentJobs: 3,
    jobTimeout: 300000, // 5 minutes
    cleanupInterval: 3600000 // 1 hour
  },
  
  // Logging settings
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: 5,
    maxSize: '10m'
  }
};
