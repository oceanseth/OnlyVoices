// Lambda worker for processing render jobs from SQS
const firebaseInitializer = require('../utils/firebaseInit.cjs');
const { ElevenLabsClient } = require('../utils/elevenlabs.cjs');
const { SecretsManager } = require('../utils/secretsManager.cjs');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsManager = new SecretsManager(process.env.AWS_REGION || 'us-east-1');

exports.handler = async (event) => {
    console.log('Render worker event:', JSON.stringify(event));

    for (const record of event.Records) {
        try {
            const jobData = JSON.parse(record.body);
            const { jobId, userId, bookId, voiceId, language } = jobData;

            console.log(`Processing render job: ${jobId} for user: ${userId}`);

            // Initialize Firebase
            await firebaseInitializer.initialize();
            const admin = require('firebase-admin');
            const db = admin.firestore();

            // Update job status to processing
            await db.collection('users').doc(userId).collection('renders').doc(jobId).update({
                status: 'processing',
                startedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Get book data
            const bookDoc = await db.collection('users').doc(userId).collection('books').doc(bookId).get();
            if (!bookDoc.exists) {
                throw new Error('Book not found');
            }
            const book = bookDoc.data();

            // Get user's ElevenLabs API key
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            
            // Try Secrets Manager first, fallback to Firestore
            let elevenLabsKey = null;
            try {
                const secret = await secretsManager.getSecret(`elevenlabs-key-${userId}`, 'prod');
                elevenLabsKey = secret?.apiKey || secret;
            } catch (e) {
                console.log('Secret not found in Secrets Manager, trying Firestore');
            }
            
            if (!elevenLabsKey) {
                elevenLabsKey = userData?.elevenlabsApiKey;
            }

            if (!elevenLabsKey) {
                throw new Error('ElevenLabs API key not configured');
            }

            // Initialize ElevenLabs client
            const elevenLabs = new ElevenLabsClient(elevenLabsKey);

            // For now, we'll render a sample text
            // In production, you would:
            // 1. Get the full book text/content
            // 2. Split into chunks
            // 3. Render each chunk
            // 4. Combine audio files
            // 5. Upload to S3

            const sampleText = `This is a sample rendering of ${book.title || 'your audiobook'}. Full implementation would process the entire book content.`;
            
            // Render audio
            const audioData = await elevenLabs.textToSpeech(voiceId, sampleText, 'eleven_multilingual_v2');

            // Upload to S3
            const s3Key = `renders/${userId}/${jobId}/audio.mp3`;
            await s3.putObject({
                Bucket: process.env.S3_BUCKET || 'onlyvoices.ai',
                Key: s3Key,
                Body: Buffer.from(audioData, 'base64'),
                ContentType: 'audio/mpeg'
            }).promise();

            const audioUrl = `https://${process.env.S3_BUCKET || 'onlyvoices.ai'}/${s3Key}`;

            // Update job status to completed
            await db.collection('users').doc(userId).collection('renders').doc(jobId).update({
                status: 'completed',
                audioUrl: audioUrl,
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Render job ${jobId} completed successfully`);

        } catch (error) {
            console.error('Error processing render job:', error);
            
            // Update job status to failed
            try {
                const jobData = JSON.parse(record.body);
                await firebaseInitializer.initialize();
                const admin = require('firebase-admin');
                const db = admin.firestore();
                
                await db.collection('users').doc(jobData.userId).collection('renders').doc(jobData.jobId).update({
                    status: 'failed',
                    error: error.message,
                    failedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (updateError) {
                console.error('Error updating failed job status:', updateError);
            }

            // Re-throw to send to DLQ after max retries
            throw error;
        }
    }

    return { statusCode: 200, body: 'Processed' };
};

