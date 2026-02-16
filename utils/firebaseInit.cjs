const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const admin = require('firebase-admin');

class FirebaseInitializer {
  constructor() {
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.firebaseApp = null;
  }

  async initialize() {
    try {
      if (this.firebaseApp) return this.firebaseApp;

      let serviceAccountJson;

      if (process.env.IS_OFFLINE === 'true' || process.env.STAGE === 'local') {
        console.log('Running in local mode - loading Firebase from environment');

        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
          throw new Error('FIREBASE_SERVICE_ACCOUNT not found in .env.local. Please copy env.local.example to .env.local and fill in your credentials.');
        }

        serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
      } else {
        console.log('Running in production mode - loading Firebase from SSM');

        const result = await this.ssmClient.send(new GetParameterCommand({
          Name: '/onlyvoices/prod/firebase_service_account',
          WithDecryption: true,
        }));

        if (!result?.Parameter?.Value) {
          throw new Error('Firebase service account credentials not found in SSM');
        }

        serviceAccountJson = result.Parameter.Value;
      }

      const serviceAccount = JSON.parse(serviceAccountJson);

      const projectId = serviceAccount.project_id;
      const resolvedStorageBucket = process.env.FIREBASE_STORAGE_BUCKET
        || serviceAccount.storageBucket
        || (projectId ? `${projectId}.firebasestorage.app` : undefined);
      const resolvedDatabaseUrl = process.env.FIREBASE_DATABASE_URL
        || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined)
        || 'https://onlyvoices-default-rtdb.firebaseio.com';

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: resolvedDatabaseUrl,
        storageBucket: resolvedStorageBucket,
      });

      if (!resolvedStorageBucket) {
        console.warn('Firebase storage bucket not specified; uploads may fail without FIREBASE_STORAGE_BUCKET.');
      } else {
        console.log(`Firebase initialized with storage bucket: ${resolvedStorageBucket}`);
      }

      return this.firebaseApp;
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  }
}

module.exports = new FirebaseInitializer();
