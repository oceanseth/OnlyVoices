// Lambda handler for OnlyVoices API

// Load local environment FIRST before any other imports
if (process.env.IS_OFFLINE === 'true' || process.env.STAGE === 'local') {
    console.log('🔧 Loading local environment for Lambda handler...');
    console.log('   IS_OFFLINE:', process.env.IS_OFFLINE);
    console.log('   STAGE:', process.env.STAGE);
    
    try {
        const { loadLocalEnv, mockSSMForLocal } = require('../local-env-loader.cjs');
        loadLocalEnv();
        mockSSMForLocal();
        console.log('   ✓ Local environment loaded');
    } catch (error) {
        console.error('❌ Failed to load local environment:', error.message);
        console.error('   Stack:', error.stack);
    }
}

const firebaseInitializer = require('../utils/firebaseInit.cjs');
const { ElevenLabsClient } = require('../utils/elevenlabs.cjs');
const { parseMultipartData } = require('./multipartParser.cjs');
const { SecretsManager } = require('../utils/secretsManager.cjs');
const { rateLimiter } = require('../utils/rateLimiter.cjs');
const AWS = require('aws-sdk');

const sqs = new AWS.SQS({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsManager = new SecretsManager(process.env.AWS_REGION || 'us-east-1');

// Helper function to verify Firebase token
async function verifyAuth(event) {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    try {
        await firebaseInitializer.initialize();
        const admin = require('firebase-admin');
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error('Auth verification error:', error);
        return null;
    }
}

// Helper function to get user's ElevenLabs API key (Secrets Manager first, then Firestore)
async function getUserElevenLabsKey(userId) {
    try {
        // Try Secrets Manager first
        const secret = await secretsManager.getSecret(`elevenlabs-key-${userId}`, 'prod');
        if (secret?.apiKey) {
            return secret.apiKey;
        }
        if (typeof secret === 'string' && secret) {
            return secret;
        }

        // Fallback to Firestore
        await firebaseInitializer.initialize();
        const admin = require('firebase-admin');
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const apiKey = userDoc.data().elevenlabsApiKey;
            // Migrate to Secrets Manager if found in Firestore
            if (apiKey) {
                try {
                    await secretsManager.putSecret(`elevenlabs-key-${userId}`, { apiKey }, 'prod');
                } catch (e) {
                    console.warn('Failed to migrate API key to Secrets Manager:', e);
                }
            }
            return apiKey;
        }
        return null;
    } catch (error) {
        console.error('Error getting ElevenLabs key:', error);
        return null;
    }
}

// Helper function to check rate limit
function checkRateLimit(userId, endpoint = 'default', maxRequests = 100) {
    const identifier = `${userId}:${endpoint}`;
    if (!rateLimiter.isAllowed(identifier, maxRequests, 60000)) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: Date.now() + 60000
        };
    }
    return {
        allowed: true,
        remaining: rateLimiter.getRemaining(identifier, maxRequests)
    };
}

// Helper function to parse request body
function parseBody(event) {
    if (!event.body) {
        return {};
    }

    if (event.isBase64Encoded) {
        return JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'));
    }

    if (typeof event.body === 'string') {
        try {
            return JSON.parse(event.body);
        } catch (e) {
            return event.body;
        }
    }

    return event.body;
}

exports.handler = async (event, context) => {
    console.log('Event received:', JSON.stringify({ 
        path: event.path, 
        httpMethod: event.httpMethod,
        headers: event.headers 
    }));
    
    // CORS: Allow requests from any origin
    const requestOrigin = event.headers?.origin || event.headers?.Origin || '*';
    const headers = {
        'Access-Control-Allow-Origin': requestOrigin === '*' ? '*' : requestOrigin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,Cache-Control,Accept,Origin',
        'Access-Control-Allow-Credentials': requestOrigin !== '*' ? 'true' : 'false',
        'Access-Control-Max-Age': '86400'
    };
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Route handling
    let path = event.path || event.rawPath || '';
    // Normalize path: ensure it starts with / and remove /api prefix if present
    if (path && !path.startsWith('/')) {
        path = '/' + path;
    }
    // Remove /prod prefix if present (added by CloudFront OriginPath or API Gateway stage)
    if (path.startsWith('/prod/')) {
        path = '/' + path.substring(6);
    }
    // Remove /api prefix if present for consistent matching
    if (path.startsWith('/api/')) {
        path = '/' + path.substring(5);
    }
    const method = event.httpMethod || event.requestContext?.http?.method;

    // Test endpoint
    if (path === '/test' && method === 'GET') {
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'OnlyVoices API is working!',
                timestamp: new Date().toISOString(),
                stage: process.env.STAGE || 'unknown'
            })
        };
    }

    // ===== CONTENT ENDPOINTS =====

    // POST /content/render - Render content with voice (replaces old books/render)
    if (path === '/content/render' && method === 'POST') {
        const user = await verifyAuth(event);
        if (!user) {
            return {
                statusCode: 401,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        const rateLimit = checkRateLimit(user.uid, 'render', 10);
        if (!rateLimit.allowed) {
            return {
                statusCode: 429,
                headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': '60' },
                body: JSON.stringify({ error: 'Rate limit exceeded', retryAfter: 60 })
            };
        }

        try {
            const body = parseBody(event);
            const { contentId, voiceId, language, text } = body;

            if (!voiceId || (!contentId && !text)) {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Voice ID and content (contentId or text) required' })
                };
            }

            const elevenLabsKey = await getUserElevenLabsKey(user.uid);
            if (!elevenLabsKey) {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'ElevenLabs API key not configured' })
                };
            }

            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            let renderText = text;
            let title = 'Custom text';

            if (contentId) {
                const contentDoc = await db.collection('users').doc(user.uid).collection('content').doc(contentId).get();
                if (!contentDoc.exists) {
                    return {
                        statusCode: 404,
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Content not found' })
                    };
                }
                renderText = contentDoc.data().text;
                title = contentDoc.data().title || 'Untitled';
            }

            const renderJobRef = await db.collection('users').doc(user.uid).collection('renders').add({
                contentId: contentId || null,
                title,
                voiceId,
                language: language || 'en',
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const queueUrl = process.env.RENDER_QUEUE_URL ||
                `https://sqs.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.AWS_ACCOUNT_ID || ''}/onlyvoices-render-jobs-${process.env.STAGE || 'prod'}`;

            await sqs.sendMessage({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify({
                    jobId: renderJobRef.id,
                    userId: user.uid,
                    contentId: contentId || null,
                    text: renderText,
                    voiceId,
                    language: language || 'en'
                })
            }).promise();

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, jobId: renderJobRef.id })
            };
        } catch (error) {
            console.error('Error starting render:', error);
            return {
                statusCode: 500,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Failed to start render', message: error.message })
            };
        }
    }

    // ===== VOICES ENDPOINTS =====

    // POST /voices/train - Train new voice
    if (path === '/voices/train' && method === 'POST') {
        const user = await verifyAuth(event);
        if (!user) {
            return {
                statusCode: 401,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        try {
            // Get user's ElevenLabs API key
            const elevenLabsKey = await getUserElevenLabsKey(user.uid);
            if (!elevenLabsKey) {
                return {
                    statusCode: 400,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'ElevenLabs API key not configured' })
                };
            }

            // Check content type
            const contentType = event.headers['Content-Type'] || event.headers['content-type'] || '';
            let name, method, files = [];

            if (contentType.includes('multipart/form-data')) {
                // Parse multipart form data
                const boundaryMatch = contentType.match(/boundary=(.+)$/);
                if (!boundaryMatch) {
                    return {
                        statusCode: 400,
                        headers: {
                            ...headers,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ error: 'Invalid multipart boundary' })
                    };
                }

                const boundary = boundaryMatch[1];
                let rawBody = event.body;
                if (event.isBase64Encoded) {
                    rawBody = Buffer.from(event.body, 'base64').toString('binary');
                } else if (typeof rawBody === 'string') {
                    rawBody = Buffer.from(rawBody, 'binary').toString('binary');
                }

                const { files: parsedFiles, fields } = parseMultipartData(rawBody, boundary);
                name = fields.name;
                method = fields.method;
                files = parsedFiles.filter(f => f.fieldName === 'audio');
            } else {
                // JSON body
                const body = parseBody(event);
                name = body.name;
                method = body.method;
            }

            if (!name) {
                return {
                    statusCode: 400,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Voice name required' })
                };
            }

            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            let voiceId = null;

            if (method === 'youtube') {
                // Extract audio from YouTube
                let youtubeUrl;
                
                if (contentType.includes('multipart/form-data')) {
                    // Already parsed above, get from fields
                    const boundaryMatch = contentType.match(/boundary=(.+)$/);
                    if (boundaryMatch) {
                        const boundary = boundaryMatch[1];
                        let rawBody = event.body;
                        if (event.isBase64Encoded) {
                            rawBody = Buffer.from(event.body, 'base64').toString('binary');
                        }
                        const { fields } = parseMultipartData(rawBody, boundary);
                        youtubeUrl = fields.youtubeUrl;
                    }
                } else {
                    const body = parseBody(event);
                    youtubeUrl = body.youtubeUrl;
                }

                if (!youtubeUrl) {
                    return {
                        statusCode: 400,
                        headers: {
                            ...headers,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ error: 'YouTube URL required' })
                    };
                }

                const youtubeExtractor = new YouTubeAudioExtractor();
                const audioData = await youtubeExtractor.extractAudio(youtubeUrl);

                // TODO: In production, implement actual audio extraction
                // This would require:
                // 1. Downloading video using yt-dlp or similar
                // 2. Extracting audio track
                // 3. Segmenting into training chunks
                // 4. Uploading to ElevenLabs
                // For now, return error indicating it needs implementation
                return {
                    statusCode: 501,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        error: 'YouTube audio extraction not yet implemented',
                        message: 'This feature requires yt-dlp or similar tool to be integrated. Please use audio file upload instead.'
                    })
                };
            } else if ((method === 'upload' || method === 'record') && files.length > 0) {
                // Train voice from uploaded files or recorded audio
                const elevenLabs = new ElevenLabsClient(elevenLabsKey);
                
                // Create voice in ElevenLabs
                const result = await elevenLabs.createVoice(name, `Voice trained by ${user.uid}`, files);
                voiceId = result.voice_id;

                // Update Firestore with voice ID
                // Note: The voice document should already exist from the frontend
                // We'll update it with the ElevenLabs voice ID
                const voicesRef = db.collection('users').doc(user.uid).collection('voices');
                const voiceDocs = await voicesRef.where('name', '==', name).limit(1).get();
                
                if (!voiceDocs.empty) {
                    await voiceDocs.docs[0].ref.update({
                        elevenlabsVoiceId: voiceId,
                        status: 'ready',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                return {
                    statusCode: 200,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: true,
                        voiceId: voiceId,
                        message: 'Voice training started successfully'
                    })
                };
            } else {
                return {
                    statusCode: 400,
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ error: 'Invalid method or no files provided' })
                };
            }
        } catch (error) {
            console.error('Error training voice:', error);
            return {
                statusCode: 500,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Failed to train voice', message: error.message })
            };
        }
    }

    // Default response for unmatched routes
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Route not found' })
    };
};
