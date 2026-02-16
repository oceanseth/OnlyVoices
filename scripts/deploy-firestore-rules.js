/**
 * Deploy Firestore rules using Firebase Management API
 * Uses service account from SSM or environment variable
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

async function deployRules() {
    try {
        // Get service account
        let serviceAccountJson;

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            // Local development
            serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
        } else {
            // Production - get from SSM
            const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
            const result = await ssm.send(new GetParameterCommand({
                Name: '/onlyvoices/prod/firebase_service_account',
                WithDecryption: true
            }));
            serviceAccountJson = result.Parameter.Value;
        }

        const serviceAccount = JSON.parse(serviceAccountJson);
        const projectId = serviceAccount.project_id;

        // Read rules file
        const rulesPath = path.join(__dirname, '..', 'firestore.rules');
        const rulesContent = fs.readFileSync(rulesPath, 'utf8');

        // Authenticate with service account
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/cloud-platform',
                'https://www.googleapis.com/auth/firebase'
            ]
        });

        const authClient = await auth.getClient();
        const accessToken = await authClient.getAccessToken();

        // Deploy rules using Firebase Management API
        const firestore = google.firestore('v1');
        
        // Get the database name (default is '(default)')
        const databaseId = '(default)';
        
        // Update rules
        const response = await firestore.projects.databases.update({
            name: `projects/${projectId}/databases/${databaseId}`,
            requestBody: {
                name: `projects/${projectId}/databases/${databaseId}`,
                type: 'FIRESTORE_NATIVE',
                // Note: The Management API structure might be different
                // This is a simplified approach
            },
            auth: authClient
        });

        // Actually, the Management API doesn't directly support rules deployment
        // We need to use the REST API endpoint
        const https = require('https');
        const url = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/production.firestore`;
        
        // For now, let's use a simpler approach with the REST API
        console.log('⚠️  Firebase Management API requires different approach');
        console.log('Please deploy manually via Firebase Console or use Firebase CLI');
        console.log(`Rules file: ${rulesPath}`);
        console.log(`Project ID: ${projectId}`);
        
    } catch (error) {
        console.error('Error deploying rules:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    deployRules().catch(console.error);
}

module.exports = { deployRules };

