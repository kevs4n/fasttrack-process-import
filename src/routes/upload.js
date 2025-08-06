const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-filename');
const logger = require('../utils/logger');
const excelProcessor = require('../services/excelProcessor');
const microsoftDownloader = require('../services/microsoftDownloader');
const config = require('../config');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../data/uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sanitizedName = sanitize(file.originalname);
    const uniqueName = `${Date.now()}-${uuidv4()}-${sanitizedName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.upload.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Only ${config.upload.allowedExtensions.join(', ')} files are allowed`));
    }
  }
});

// Upload local file
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      id: uuidv4(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
      source: 'local'
    };

    // Save file metadata
    const metadataPath = path.join(__dirname, '../../data/uploads', `${fileInfo.id}.meta.json`);
    await fs.writeJson(metadataPath, fileInfo);

    logger.info(`File uploaded: ${fileInfo.originalName} (${fileInfo.id})`);

    res.json({
      success: true,
      file: fileInfo,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// Download from Microsoft repository
router.post('/microsoft', async (req, res) => {
  try {
    const { fileName, processType } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    logger.info(`Downloading from Microsoft repository: ${fileName}`);

    const downloadResult = await microsoftDownloader.downloadFile(fileName, processType);

    res.json({
      success: true,
      file: downloadResult,
      message: 'File downloaded successfully from Microsoft repository'
    });

  } catch (error) {
    logger.error('Microsoft download error:', error);
    res.status(500).json({
      error: 'Download failed',
      message: error.message
    });
  }
});

// List available Microsoft files
router.get('/microsoft/files', async (req, res) => {
  try {
    const files = await microsoftDownloader.listAvailableFiles();
    res.json({
      success: true,
      files
    });
  } catch (error) {
    logger.error('Error listing Microsoft files:', error);
    res.status(500).json({
      error: 'Failed to list files',
      message: error.message
    });
  }
});

// List uploaded files
router.get('/files', async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '../../data/uploads');
    const files = await fs.readdir(uploadsDir);
    
    const fileList = [];
    
    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const metadataPath = path.join(uploadsDir, file);
        const metadata = await fs.readJson(metadataPath);
        
        // Check if actual file still exists
        const fileExists = await fs.pathExists(metadata.path);
        if (fileExists) {
          fileList.push(metadata);
        }
      }
    }

    // Sort by upload date (newest first)
    fileList.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({
      success: true,
      files: fileList
    });

  } catch (error) {
    logger.error('Error listing files:', error);
    res.status(500).json({
      error: 'Failed to list files',
      message: error.message
    });
  }
});

// Delete uploaded file
router.delete('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const uploadsDir = path.join(__dirname, '../../data/uploads');
    const metadataPath = path.join(uploadsDir, `${id}.meta.json`);

    // Check if metadata exists
    const metadataExists = await fs.pathExists(metadataPath);
    if (!metadataExists) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read metadata to get file path
    const metadata = await fs.readJson(metadataPath);

    // Delete actual file
    if (await fs.pathExists(metadata.path)) {
      await fs.remove(metadata.path);
    }

    // Delete metadata
    await fs.remove(metadataPath);

    logger.info(`File deleted: ${metadata.originalName} (${id})`);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting file:', error);
    res.status(500).json({
      error: 'Failed to delete file',
      message: error.message
    });
  }
});

// Get file details
router.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const uploadsDir = path.join(__dirname, '../../data/uploads');
    const metadataPath = path.join(uploadsDir, `${id}.meta.json`);

    const metadataExists = await fs.pathExists(metadataPath);
    if (!metadataExists) {
      return res.status(404).json({ error: 'File not found' });
    }

    const metadata = await fs.readJson(metadataPath);

    // Check if actual file still exists
    const fileExists = await fs.pathExists(metadata.path);
    if (!fileExists) {
      return res.status(404).json({ error: 'File data not found' });
    }

    res.json({
      success: true,
      file: metadata
    });

  } catch (error) {
    logger.error('Error getting file details:', error);
    res.status(500).json({
      error: 'Failed to get file details',
      message: error.message
    });
  }
});

module.exports = router;
