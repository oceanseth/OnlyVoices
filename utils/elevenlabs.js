const https = require('https');
const http = require('http');

class ElevenLabsClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'api.elevenlabs.io';
    }

    async request(method, path, data = null, options = {}) {
        return new Promise((resolve, reject) => {
            const postData = data ? JSON.stringify(data) : null;
            const headers = {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json'
            };

            if (options.headers) {
                Object.assign(headers, options.headers);
            }

            const reqOptions = {
                hostname: this.baseUrl,
                port: 443,
                path: path,
                method: method,
                headers: headers
            };

            const req = https.request(reqOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const parsed = body ? JSON.parse(body) : {};
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`ElevenLabs API error: ${res.statusCode} - ${parsed.detail?.message || body}`));
                        }
                    } catch (e) {
                        resolve(body); // Return raw body if not JSON
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }

    async getVoices() {
        return this.request('GET', '/v1/voices');
    }

    async createVoice(name, description, files) {
        // Create voice using multipart form data (manual construction)
        return new Promise((resolve, reject) => {
            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
            const parts = [];

            // Add name field
            parts.push(`--${boundary}\r\n`);
            parts.push(`Content-Disposition: form-data; name="name"\r\n\r\n`);
            parts.push(`${name}\r\n`);

            // Add description if provided
            if (description) {
                parts.push(`--${boundary}\r\n`);
                parts.push(`Content-Disposition: form-data; name="description"\r\n\r\n`);
                parts.push(`${description}\r\n`);
            }

            // Add files
            files.forEach((file, index) => {
                const fileName = file.fileName || `audio_${index}.mp3`;
                const contentType = file.contentType || 'audio/mpeg';
                
                parts.push(`--${boundary}\r\n`);
                parts.push(`Content-Disposition: form-data; name="files"; filename="${fileName}"\r\n`);
                parts.push(`Content-Type: ${contentType}\r\n\r\n`);
                parts.push(file.data);
                parts.push(`\r\n`);
            });

            parts.push(`--${boundary}--\r\n`);

            const body = Buffer.concat(parts.map(part => Buffer.isBuffer(part) ? part : Buffer.from(part, 'utf8')));

            const headers = {
                'xi-api-key': this.apiKey,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length.toString()
            };

            const reqOptions = {
                hostname: this.baseUrl,
                port: 443,
                path: '/v1/voices/add',
                method: 'POST',
                headers: headers
            };

            const req = https.request(reqOptions, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseBody);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`ElevenLabs API error: ${res.statusCode} - ${parsed.detail?.message || responseBody}`));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${responseBody}`));
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            req.write(body);
            req.end();
        });
    }

    async textToSpeech(voiceId, text, modelId = 'eleven_multilingual_v2') {
        return this.request('POST', `/v1/text-to-speech/${voiceId}`, {
            text: text,
            model_id: modelId,
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        });
    }

    async getVoice(voiceId) {
        return this.request('GET', `/v1/voices/${voiceId}`);
    }
}

module.exports = { ElevenLabsClient };

