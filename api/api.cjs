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
const { YouTubeAudioExtractor } = require('../utils/youtube.cjs');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
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

// Helper function to look up a creator by their public `username` field.
async function getCreatorByUsername(db, username) {
    if (!username) return null;
    const creatorSnap = await db.collection('users')
        .where('username', '==', username)
        .limit(1)
        .get();

    if (creatorSnap.empty) return null;
    const docSnap = creatorSnap.docs[0];
    return { creatorId: docSnap.id, data: docSnap.data() };
}

async function createVapiAssistantForElevenLabsVoice({ elevenlabsVoiceId }) {
    const vapiApiKey =
        (await secretsManager.getSecret('vapi-api-key', 'prod')) ||
        process.env.VAPI_API_KEY;

    if (!vapiApiKey) {
        throw new Error('Vapi API key not configured (missing vapi-api-key secret or VAPI_API_KEY env var)');
    }

    const payload = {
        // These are the required top-level assistant fields in Vapi.
        name: 'OnlyVoicesCreatorCallAssistant',
        firstMessage: 'Hi! Speak naturally and I will respond.',
        model: {
            provider: 'openai',
            model: process.env.VAPI_MODEL || 'gpt-4o-mini',
            temperature: 0.7,
            messages: [
                {
                    role: 'system',
                    content: 'You are a friendly conversational voice agent for OnlyVoices. Keep responses concise.'
                }
            ]
        },
        voice: {
            provider: '11labs',
            voiceId: elevenlabsVoiceId
        }
    };

    const res = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${vapiApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Failed to create Vapi assistant (${res.status})`);
    }

    return data?.id || data?.assistantId;
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

// Helper function to get Stripe client (lazy-loaded from SSM)
let stripeClient = null;
async function getStripeClient() {
    if (stripeClient) return stripeClient;
    try {
        // Try SSM parameter first
        const secret = await secretsManager.getSecret('stripe-secret-key', 'prod');
        const key = typeof secret === 'string' ? secret : secret?.key || secret?.apiKey;
        if (key) {
            const Stripe = require('stripe');
            stripeClient = new Stripe(key);
            return stripeClient;
        }
        // Try env variable
        if (process.env.STRIPE_SECRET_KEY) {
            const Stripe = require('stripe');
            stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
            return stripeClient;
        }
        return null;
    } catch (error) {
        console.warn('Stripe not available:', error.message);
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

    // ===== Vapi Public Call Flow =====
    //
    // GET /vapi/public/creator?username=:username
    // Public endpoint (no auth) used by the public `/:username` call page.
    if (path === '/vapi/public/creator' && method === 'GET') {
        try {
            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            const username = event.queryStringParameters?.username || '';
            const creator = await getCreatorByUsername(db, username);
            if (!creator) {
                return {
                    statusCode: 404,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Creator not found' })
                };
            }

            const creatorData = creator.data || {};
            const tokensPerMinute = creatorData.tokensPerMinute ?? 10;
            const defaultVoiceId = creatorData.defaultVoiceId || null;

            let defaultVoice = { voiceId: defaultVoiceId, status: 'missing' };
            if (defaultVoiceId) {
                const voiceDoc = await db.collection('users').doc(creator.creatorId)
                    .collection('voices')
                    .doc(defaultVoiceId)
                    .get();

                if (voiceDoc.exists) {
                    defaultVoice = {
                        voiceId: voiceDoc.id,
                        status: voiceDoc.data()?.status || 'missing',
                    };
                }
            }

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: creator.creatorId,
                    displayName: creatorData.displayName || username,
                    username,
                    tokensPerMinute,
                    defaultVoiceReady: defaultVoice.status === 'ready',
                    defaultVoice
                })
            };
        } catch (error) {
            console.error('Vapi public creator error:', error);
            return {
                statusCode: 500,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Failed to load creator', message: error.message })
            };
        }
    }

    // POST /vapi/call/sessions/start
    // Auth required. Creates a session and returns a Vapi assistantId to start the Web SDK call.
    if (path === '/vapi/call/sessions/start' && method === 'POST') {
        const user = await verifyAuth(event);
        if (!user) {
            return {
                statusCode: 401,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        try {
            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            const body = parseBody(event);
            const { username } = body || {};
            if (!username) {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'username is required' })
                };
            }

            const creator = await getCreatorByUsername(db, username);
            if (!creator) {
                return {
                    statusCode: 404,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Creator not found' })
                };
            }

            const creatorData = creator.data || {};
            const tokensPerMinute = creatorData.tokensPerMinute ?? 10;
            const defaultVoiceId = creatorData.defaultVoiceId || null;
            if (!defaultVoiceId) {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Creator has no default voice set' })
                };
            }

            const voiceRef = db.collection('users').doc(creator.creatorId).collection('voices').doc(defaultVoiceId);
            const voiceDoc = await voiceRef.get();
            if (!voiceDoc.exists) {
                return {
                    statusCode: 404,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Default voice not found' })
                };
            }

            const voiceData = voiceDoc.data() || {};
            if (voiceData.status !== 'ready') {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Default voice is not ready' })
                };
            }

            if (!voiceData.elevenlabsVoiceId) {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Default voice is missing elevenlabsVoiceId' })
                };
            }

            // Provision a per-voice Vapi assistant if missing.
            let vapiAssistantId = voiceData.vapiAssistantId || null;
            if (!vapiAssistantId) {
                vapiAssistantId = await createVapiAssistantForElevenLabsVoice({
                    elevenlabsVoiceId: voiceData.elevenlabsVoiceId
                });

                if (!vapiAssistantId) {
                    throw new Error('Vapi assistant creation did not return an id');
                }

                await voiceRef.set({
                    vapiAssistantId,
                    vapiAssistantUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            const tokenBalance = userData.tokenBalance ?? 100;

            if (tokenBalance < tokensPerMinute) {
                return {
                    statusCode: 402,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        error: 'Insufficient credits',
                        tokenBalance,
                        tokensPerMinute
                    })
                };
            }

            const sessionRef = db.collection('vapiCallSessions').doc();
            await sessionRef.set({
                userId: user.uid,
                creatorId: creator.creatorId,
                creatorUsername: username,
                defaultVoiceId,
                tokensPerMinute,
                vapiAssistantId,
                status: 'active',
                minutesBilled: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionRef.id,
                    vapiAssistantId,
                    tokensPerMinute,
                    tokenBalance,
                })
            };
        } catch (error) {
            console.error('Vapi start session error:', error);
            return {
                statusCode: 500,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Failed to start voice session', message: error.message })
            };
        }
    }

    // POST /vapi/call/sessions/:sessionId/debitMinute
    if (method === 'POST' && path.startsWith('/vapi/call/sessions/') && path.endsWith('/debitMinute')) {
        const user = await verifyAuth(event);
        if (!user) {
            return {
                statusCode: 401,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        try {
            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            const parts = path.split('/').filter(Boolean);
            const sessionId = parts[3];
            if (!sessionId) {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'sessionId not found in path' })
                };
            }

            const sessionRef = db.collection('vapiCallSessions').doc(sessionId);

            let result = { ok: false, reason: 'unknown' };
            await db.runTransaction(async (tx) => {
                const sessionSnap = await tx.get(sessionRef);
                if (!sessionSnap.exists) {
                    result = { ok: false, reason: 'session_not_found' };
                    return;
                }

                const sessionData = sessionSnap.data() || {};
                if (sessionData.userId !== user.uid) {
                    result = { ok: false, reason: 'forbidden' };
                    return;
                }
                if (sessionData.status !== 'active') {
                    result = { ok: false, reason: 'session_inactive' };
                    return;
                }

                const userRef = db.collection('users').doc(user.uid);
                const userSnap = await tx.get(userRef);
                const userData = userSnap.exists ? userSnap.data() : {};
                const tokenBalance = userData.tokenBalance ?? 100;
                const tokensPerMinute = sessionData.tokensPerMinute ?? 10;

                if (tokenBalance < tokensPerMinute) {
                    result = { ok: false, reason: 'insufficient_tokens', tokenBalance };
                    return;
                }

                const newBalance = tokenBalance - tokensPerMinute;
                tx.update(userRef, { tokenBalance: newBalance });
                tx.update(sessionRef, {
                    minutesBilled: (sessionData.minutesBilled || 0) + 1,
                    lastBilledAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                result = { ok: true, tokenBalance: newBalance };
            });

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(result)
            };
        } catch (error) {
            console.error('Vapi debit minute error:', error);
            return {
                statusCode: 500,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Failed to debit credits', message: error.message })
            };
        }
    }

    // POST /vapi/call/sessions/:sessionId/end
    if (method === 'POST' && path.startsWith('/vapi/call/sessions/') && path.endsWith('/end')) {
        const user = await verifyAuth(event);
        if (!user) {
            return {
                statusCode: 401,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        try {
            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            const parts = path.split('/').filter(Boolean);
            const sessionId = parts[3];
            if (!sessionId) {
                return {
                    statusCode: 400,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'sessionId not found in path' })
                };
            }

            const sessionRef = db.collection('vapiCallSessions').doc(sessionId);
            const sessionSnap = await sessionRef.get();
            if (!sessionSnap.exists) {
                return {
                    statusCode: 404,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Session not found' })
                };
            }

            const sessionData = sessionSnap.data() || {};
            if (sessionData.userId !== user.uid) {
                return {
                    statusCode: 403,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Forbidden' })
                };
            }

            if (sessionData.status === 'active') {
                await sessionRef.set({
                    status: 'ended',
                    endedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ok: true })
            };
        } catch (error) {
            console.error('Vapi end session error:', error);
            return {
                statusCode: 500,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Failed to end session', message: error.message })
            };
        }
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

            await sqs.send(new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify({
                    jobId: renderJobRef.id,
                    userId: user.uid,
                    contentId: contentId || null,
                    text: renderText,
                    voiceId,
                    language: language || 'en'
                })
            }));

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
                    const createdVoiceId = voiceDocs.docs[0].id;

                    await voiceDocs.docs[0].ref.update({
                        elevenlabsVoiceId: voiceId,
                        status: 'ready',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // If the creator hasn't picked a default voice yet, default to their first ready voice.
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.exists ? userDoc.data() : {};
                    if (!userData.defaultVoiceId) {
                        await db.collection('users').doc(user.uid).set(
                            { defaultVoiceId: createdVoiceId },
                            { merge: true }
                        );
                    }
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

    // ===== PAYMENT ENDPOINTS (Stripe Connect) =====

    // POST /payments/connect-account - Create Stripe Connect account for creator
    if (path === '/payments/connect-account' && method === 'POST') {
        const user = await verifyAuth(event);
        if (!user) {
            return { statusCode: 401, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        try {
            const stripe = await getStripeClient();
            if (!stripe) {
                return { statusCode: 503, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Stripe not configured' }) };
            }

            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            let stripeAccountId = userData.stripeAccountId;

            if (!stripeAccountId) {
                const account = await stripe.accounts.create({
                    type: 'express',
                    email: user.email,
                    metadata: { userId: user.uid },
                    capabilities: {
                        card_payments: { requested: true },
                        transfers: { requested: true },
                    },
                });
                stripeAccountId = account.id;
                await db.collection('users').doc(user.uid).set({ stripeAccountId }, { merge: true });
            }

            const baseUrl = event.headers?.origin || event.headers?.Origin || 'https://onlyvoices.ai';
            const accountLink = await stripe.accountLinks.create({
                account: stripeAccountId,
                refresh_url: `${baseUrl}/settings?stripe=retry`,
                return_url: `${baseUrl}/settings?stripe=success`,
                type: 'account_onboarding',
            });

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: accountLink.url })
            };
        } catch (error) {
            console.error('Stripe Connect error:', error);
            return { statusCode: 500, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
        }
    }

    // GET /payments/connect-dashboard - Get Stripe dashboard link for creator
    if (path === '/payments/connect-dashboard' && method === 'GET') {
        const user = await verifyAuth(event);
        if (!user) {
            return { statusCode: 401, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        try {
            const stripe = await getStripeClient();
            if (!stripe) {
                return { statusCode: 503, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Stripe not configured' }) };
            }

            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();
            const userDoc = await db.collection('users').doc(user.uid).get();
            const stripeAccountId = userDoc.data()?.stripeAccountId;

            if (!stripeAccountId) {
                return { statusCode: 400, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Stripe account not connected' }) };
            }

            const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);
            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: loginLink.url })
            };
        } catch (error) {
            console.error('Stripe dashboard link error:', error);
            return { statusCode: 500, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
        }
    }

    // POST /payments/checkout - Create checkout session for a voice reading
    if (path === '/payments/checkout' && method === 'POST') {
        const user = await verifyAuth(event);
        if (!user) {
            return { statusCode: 401, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        try {
            const stripe = await getStripeClient();
            if (!stripe) {
                return { statusCode: 503, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Stripe not configured' }) };
            }

            const body = parseBody(event);
            const { listingId, creatorId } = body;

            if (!listingId || !creatorId) {
                return { statusCode: 400, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'listingId and creatorId required' }) };
            }

            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            const listingDoc = await db.collection('listings').doc(listingId).get();
            if (!listingDoc.exists) {
                return { statusCode: 404, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Listing not found' }) };
            }

            const listing = listingDoc.data();
            const creatorDoc = await db.collection('users').doc(creatorId).get();
            const creatorStripeId = creatorDoc.data()?.stripeAccountId;

            if (!creatorStripeId) {
                return { statusCode: 400, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Creator has not connected Stripe' }) };
            }

            const price = listing.price || 500; // cents
            const platformFee = Math.round(price * 0.20); // 20% platform fee

            const baseUrl = event.headers?.origin || event.headers?.Origin || 'https://onlyvoices.ai';
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: listing.name || 'Voice Reading',
                            description: `Voice reading by ${listing.creatorName || 'Creator'}`,
                        },
                        unit_amount: price,
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                payment_intent_data: {
                    application_fee_amount: platformFee,
                    transfer_data: { destination: creatorStripeId },
                },
                metadata: {
                    listingId,
                    creatorId,
                    buyerId: user.uid,
                },
                success_url: `${baseUrl}/marketplace?purchase=success`,
                cancel_url: `${baseUrl}/marketplace?purchase=cancelled`,
            });

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: session.id, url: session.url })
            };
        } catch (error) {
            console.error('Checkout error:', error);
            return { statusCode: 500, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
        }
    }

    // GET /payments/earnings - Get creator earnings summary
    if (path === '/payments/earnings' && method === 'GET') {
        const user = await verifyAuth(event);
        if (!user) {
            return { statusCode: 401, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        try {
            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            const txSnap = await db.collection('users').doc(user.uid).collection('transactions')
                .orderBy('createdAt', 'desc').limit(100).get();

            const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const totalEarnings = transactions.reduce((sum, tx) => sum + (tx.creatorAmount || 0), 0);

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalEarnings, transactions })
            };
        } catch (error) {
            console.error('Earnings error:', error);
            return { statusCode: 500, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
        }
    }

    // ===== USER PROFILE ENDPOINTS =====

    // GET /user/profile
    if (path === '/user/profile' && method === 'GET') {
        const user = await verifyAuth(event);
        if (!user) {
            return { statusCode: 401, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        try {
            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();
            const userDoc = await db.collection('users').doc(user.uid).get();
            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(userDoc.exists ? userDoc.data() : {})
            };
        } catch (error) {
            return { statusCode: 500, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
        }
    }

    // PUT /user/profile
    if (path === '/user/profile' && method === 'PUT') {
        const user = await verifyAuth(event);
        if (!user) {
            return { statusCode: 401, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        try {
            const body = parseBody(event);
            const allowedFields = ['displayName', 'bio', 'username', 'pricePerReading', 'isCreator', 'photoURL'];
            const updates = {};
            for (const key of allowedFields) {
                if (body[key] !== undefined) updates[key] = body[key];
            }

            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();
            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            await db.collection('users').doc(user.uid).set(updates, { merge: true });

            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true })
            };
        } catch (error) {
            return { statusCode: 500, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
        }
    }

    // Default response for unmatched routes
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Route not found' })
    };
};
