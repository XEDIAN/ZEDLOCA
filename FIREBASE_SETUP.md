# Firebase Setup Instructions

## Fix for "Missing or insufficient permissions" Error

This error occurs with Firebase v12+ due to stricter security rules enforcement. The following files have been created/updated to resolve this issue:

### Files Created/Updated:
- `src/firebase.js` - Updated with proper Firebase v12 imports and emulator support
- `firestore.rules` - Firestore security rules
- `firebase.json` - Firebase project configuration
- `firestore.indexes.json` - Required database indexes

## Deployment Steps

### 1. Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```

### 3. Initialize Firebase Project (if not already done)
```bash
firebase init
```
Select Firestore and Hosting when prompted.

### 4. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

### 5. Deploy Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

### 6. Test Your Application
Start your development server:
```bash
npm run dev
```

## Security Rules Explanation

The rules allow:
- **Listings**: Read by anyone, write only by owner
- **Sellers**: Read by anyone, write only by owner
- **Users**: Read/write only by owner
- **Messages**: Read/write by participants
- **Orders**: Read/write by buyer and seller

## Common Issues

### If you still get permission errors:
1. Ensure you're authenticated in your app
2. Check that the Firebase project ID matches
3. Verify the rules are deployed: `firebase deploy --only firestore:rules`

### For local development:
The application is configured to work with production Firebase. No emulator setup is required.

## Next Steps
After deploying the rules, your Firebase operations should work correctly. The "Missing or insufficient permissions" error should be resolved.
