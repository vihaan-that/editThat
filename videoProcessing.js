const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

/**
 * Process video with ffmpeg to create a trimmed version
 * @param {string} inputPath Path to input video file
 * @param {Object} options Trim options
 * @param {number} [options.trimStart] Seconds to trim from start
 * @param {number} [options.trimEnd] Seconds to trim from end
 * @returns {Promise<Object>} Object containing output path and duration
 */
async function processVideo(inputPath, options) {
    // Generate output filename
    const dir = path.dirname(inputPath);
    const ext = path.extname(inputPath);
    const basename = path.basename(inputPath, ext);
    const timestamp = Date.now();
    const outputPath = path.join(dir, `${basename}-trimmed-${timestamp}${ext}`);

    // Get video duration first if we need to trim from end
    let duration = null;
    if (options.trimEnd) {
        duration = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(inputPath, (err, metadata) => {
                if (err) reject(err);
                resolve(metadata.format.duration);
            });
        });
    }

    return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Apply trim from start if specified
        if (options.trimStart) {
            command = command.setStartTime(options.trimStart);
        }

        // Apply trim from end if specified
        if (options.trimEnd && duration) {
            const endTime = duration - options.trimEnd;
            command = command.setDuration(endTime);
        }

        command
            .output(outputPath)
            .on('end', async () => {
                // Get final duration of processed video
                const finalDuration = await new Promise((resolve, reject) => {
                    ffmpeg.ffprobe(outputPath, (err, metadata) => {
                        if (err) reject(err);
                        resolve(metadata.format.duration);
                    });
                });

                resolve({
                    outputPath,
                    duration: finalDuration
                });
            })
            .on('error', (err) => {
                reject(new Error(`Error processing video: ${err.message}`));
            })
            .run();
    });
}

module.exports = {
    processVideo
};
