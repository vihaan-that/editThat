const request = require('supertest');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { getDb } = require('../db');

describe('POST /upload', () => {
    before(async () => {
        // Setup: Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir);
        }
        
        // Initialize database
        const db = getDb();
        db.exec(`
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                size INTEGER NOT NULL,
                duration FLOAT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });

    after(() => {
        // Cleanup: Remove test files from uploads directory
        const uploadsDir = path.join(__dirname, '../uploads');
        fs.readdirSync(uploadsDir).forEach(file => {
            fs.unlinkSync(path.join(uploadsDir, file));
        });
    });

    it('should reject when no file is provided', async () => {
        const response = await request(app)
            .post('/upload')
            .expect(400);
        
        expect(response.body.error).to.equal('No video file provided');
    });

    it('should reject invalid file types', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('video', path.join(__dirname, 'fixtures/test.txt'))
            .expect(400);
        
        expect(response.body.error).to.equal('Invalid file type. Only video files are allowed');
    });

    it('should successfully upload a valid video file', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('video', path.join(__dirname, 'fixtures/test-video.mp4'))
            .expect(200);
        
        expect(response.body).to.have.property('id');
        expect(response.body).to.have.property('filename');
        expect(response.body).to.have.property('duration');
        expect(response.body).to.have.property('size');
    });

    it('should reject videos that exceed maximum duration', async () => {
        const response = await request(app)
            .post('/upload')
            .attach('video', path.join(__dirname, 'fixtures/long-video.mp4'))
            .expect(400);
        
        expect(response.body.error).to.equal('Video duration exceeds maximum allowed length');
    });
});
