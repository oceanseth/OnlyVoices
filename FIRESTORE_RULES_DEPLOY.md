# Firestore Security Rules Deployment

## Issue
Users are getting "Missing or insufficient permissions" errors when trying to save data to Firestore.

## Solution
Deploy the Firestore security rules to allow authenticated users to read/write their own data.

## Deployment Options

### Option 1: Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/project/onlyvoices-ed470/firestore/rules)
2. Copy the contents of `firestore.rules`
3. Paste into the rules editor
4. Click "Publish"

### Option 2: Firebase CLI
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

## Rules Overview
The rules allow:
- Users to read/write their own user document
- Users to read/write their own subcollections (books, voices, renders, data)
- All operations require authentication

## Testing
After deploying, test by:
1. Logging in to the app
2. Trying to save the ElevenLabs API key in Settings
3. Should work without permission errors

