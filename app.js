const express = require('express');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { getDb } = require('./db');
const { processVideo } = require('./videoProcessing');

const app = express();
app.use(express.json()); // Add this line for JSON body parsing

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

// Video trimming endpoint
app.post('/videos/:id/trim', async (req, res) => {
    try {
        const { trimStart, trimEnd } = req.body;
        const videoId = parseInt(req.params.id);

        // Validate parameters
        if (!trimStart && !trimEnd) {
            return res.status(400).json({ error: 'Invalid trim parameters. Provide either trimStart or trimEnd' });
        }

        if ((trimStart && trimStart < 0) || (trimEnd && trimEnd < 0)) {
            return res.status(400).json({ error: 'Trim values must be positive numbers' });
        }

        // Get video from database
        const db = getDb();
        const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Process video
        const { outputPath, duration } = await processVideo(video.filepath, {
            trimStart,
            trimEnd
        });

        // Save new video to database
        const result = db.prepare(`
            INSERT INTO videos (filename, filepath, size, duration)
            VALUES (?, ?, ?, ?)
        `).run(
            path.basename(outputPath),
            outputPath,
            require('fs').statSync(outputPath).size,
            duration
        );

        // Return new video details
        res.json({
            id: result.lastInsertRowid,
            filename: path.basename(outputPath),
            duration: duration,
            size: require('fs').statSync(outputPath).size
        });

    } catch (error) {
        res.status(500).json({ error: 'Error processing video: ' + error.message });
    }
});

module.exports = app;
