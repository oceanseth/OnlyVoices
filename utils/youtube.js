const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const https = require('https');

const execAsync = promisify(exec);

/**
 * Extract audio from YouTube video using yt-dlp
 * 
 * Note: yt-dlp must be available in the Lambda environment.
 * To add yt-dlp to Lambda:
 * 1. Create a Lambda layer with yt-dlp binary
 * 2. Or use a container image with yt-dlp pre-installed
 * 3. Or use an external service/API
 */
class YouTubeAudioExtractor {
    constructor() {
        // Check if yt-dlp is available
        this.ytdlpPath = process.env.YTDLP_PATH || '/opt/bin/yt-dlp';
        this.tempDir = '/tmp';
    }

    /**
     * Check if yt-dlp is available
     */
    async checkYtDlpAvailable() {
        try {
            await execAsync(`${this.ytdlpPath} --version`);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Extract audio from YouTube URL
     * @param {string} youtubeUrl - YouTube video URL
     * @returns {Promise<{audioData: Buffer, format: string, duration: number, videoId: string}>}
     */
    async extractAudio(youtubeUrl) {
        const videoId = this.extractVideoId(youtubeUrl);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        // Check if yt-dlp is available
        const ytdlpAvailable = await this.checkYtDlpAvailable();
        if (!ytdlpAvailable) {
            throw new Error('yt-dlp is not available. Please add yt-dlp to your Lambda layer.');
        }

        const outputPath = path.join(this.tempDir, `${videoId}.mp3`);

        try {
            // Download audio using yt-dlp
            // Format: bestaudio[ext=m4a]/bestaudio/best
            // Convert to MP3 using ffmpeg (must also be in Lambda layer)
            const command = `${this.ytdlpPath} -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${youtubeUrl}"`;
            
            console.log(`Executing: ${command}`);
            const { stdout, stderr } = await execAsync(command, {
                timeout: 300000, // 5 minutes timeout
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });

            console.log('yt-dlp output:', stdout);
            if (stderr) {
                console.warn('yt-dlp stderr:', stderr);
            }

            // Read the downloaded audio file
            const audioData = fs.readFileSync(outputPath);
            
            // Get duration (yt-dlp outputs JSON with duration)
            const infoCommand = `${this.ytdlpPath} --dump-json "${youtubeUrl}"`;
            let duration = 0;
            try {
                const { stdout: infoJson } = await execAsync(infoCommand);
                const info = JSON.parse(infoJson);
                duration = info.duration || 0;
            } catch (e) {
                console.warn('Could not get video duration:', e);
            }

            // Clean up
            try {
                fs.unlinkSync(outputPath);
            } catch (e) {
                console.warn('Could not delete temp file:', e);
            }

            return {
                audioData: audioData,
                format: 'mp3',
                duration: duration,
                videoId: videoId
            };
        } catch (error) {
            // Clean up on error
            try {
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
            throw new Error(`Failed to extract audio: ${error.message}`);
        }
    }

    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/watch\?.*v=([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    /**
     * Segment audio into chunks for voice training
     * Voice training typically requires 1-3 minutes of clean audio per segment
     * @param {Buffer} audioBuffer - Audio data
     * @param {number} segmentDuration - Duration of each segment in seconds (default: 120)
     * @returns {Promise<Array<{data: Buffer, startTime: number, endTime: number}>>}
     */
    async segmentAudio(audioBuffer, segmentDuration = 120) {
        // This requires ffmpeg to be available in Lambda
        // For now, return a placeholder
        // In production, use ffmpeg to split audio:
        // ffmpeg -i input.mp3 -f segment -segment_time 120 -c copy output_%03d.mp3
        
        const ffmpegPath = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
        const inputPath = path.join(this.tempDir, `input_${Date.now()}.mp3`);
        const outputPattern = path.join(this.tempDir, `segment_%03d.mp3`);

        try {
            // Write input buffer to temp file
            fs.writeFileSync(inputPath, audioBuffer);

            // Use ffmpeg to segment
            const command = `${ffmpegPath} -i "${inputPath}" -f segment -segment_time ${segmentDuration} -c copy "${outputPattern}" -y`;
            await execAsync(command);

            // Read all segments
            const segments = [];
            let segmentIndex = 0;
            while (true) {
                const segmentPath = path.join(this.tempDir, `segment_${String(segmentIndex).padStart(3, '0')}.mp3`);
                if (!fs.existsSync(segmentPath)) {
                    break;
                }
                const segmentData = fs.readFileSync(segmentPath);
                segments.push({
                    data: segmentData,
                    startTime: segmentIndex * segmentDuration,
                    endTime: (segmentIndex + 1) * segmentDuration
                });
                fs.unlinkSync(segmentPath);
                segmentIndex++;
            }

            // Clean up input file
            fs.unlinkSync(inputPath);

            return segments;
        } catch (error) {
            // Clean up on error
            try {
                if (fs.existsSync(inputPath)) {
                    fs.unlinkSync(inputPath);
                }
            } catch (e) {
                // Ignore
            }
            throw new Error(`Failed to segment audio: ${error.message}`);
        }
    }
}

module.exports = { YouTubeAudioExtractor };
