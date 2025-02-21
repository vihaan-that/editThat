const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { getDb } = require('./db');

const app = express();

// Configure multer for video upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept only video files
    if (file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only video files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
    }
});

// Video upload endpoint
app.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        // Get video duration using ffprobe
        const duration = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(req.file.path, (err, metadata) => {
                if (err) reject(err);
                resolve(metadata.format.duration);
            });
        });

        // Check duration limits (e.g., max 5 minutes)
        const MAX_DURATION = 300; // 5 minutes in seconds
        if (duration > MAX_DURATION) {
            // Remove the uploaded file
            require('fs').unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Video duration exceeds maximum allowed length' });
        }

        // Store video metadata in database
        const db = getDb();
        const result = db.prepare(`
            INSERT INTO videos (filename, filepath, size, duration)
            VALUES (?, ?, ?, ?)
        `).run(
            req.file.filename,
            req.file.path,
            req.file.size,
            duration
        );

        // Return success response
        res.json({
            id: result.lastInsertRowid,
            filename: req.file.filename,
            size: req.file.size,
            duration: duration
        });

    } catch (error) {
        // If any error occurs, remove the uploaded file
        if (req.file) {
            require('fs').unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Error processing video upload: ' + error.message });
    }
});

module.exports = app;
