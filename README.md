# Video Upload Service

A Node.js service that handles video uploads with the following features:
- File upload handling using Multer
- Video duration validation using ffprobe
- SQLite database storage for video metadata
- Test-driven development approach

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create test videos:
Place test video files in `tests/fixtures/`:
- `test-video.mp4`: A short valid video file (< 5 minutes)
- `long-video.mp4`: A video longer than 5 minutes
- `test.txt`: A non-video file for testing invalid uploads

3. Run tests:
```bash
npm test
```

4. Start the server:
```bash
npm start
```

## API Endpoints

### POST /upload
Upload a video file with the following constraints:
- Maximum file size: 100MB
- Maximum duration: 5 minutes
- Accepted file types: video/*

#### Request
- Method: POST
- Content-Type: multipart/form-data
- Body parameter: video (file)

#### Response
Success (200):
```json
{
    "id": 1,
    "filename": "1234567890-video.mp4",
    "size": 1024000,
    "duration": 120.5
}
```

Error (400/500):
```json
{
    "error": "Error message"
}
```
