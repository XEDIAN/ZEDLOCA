# Firebase Storage CORS Configuration

This document explains how to fix CORS issues when uploading images to Firebase Storage from localhost.

## Problem

When trying to upload images from localhost (e.g., `http://localhost:5194`), you may encounter CORS errors like:

```
Access to fetch at 'https://firebasestorage.googleapis.com/v0/b/zedloca.appspot.com/o?name=listings/...' from origin 'http://localhost:5194' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: It does not have HTTP ok status.
```

## Solution

Firebase Storage requires explicit CORS configuration to allow requests from specific origins.

### Step 1: Install Google Cloud Storage SDK

```bash
npm install @google-cloud/storage
```

### Step 2: Set up Google Cloud credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to IAM & Admin > Service Accounts
3. Create a new service account or use an existing one
4. Generate a JSON key file
5. Set the environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/your/service-account-key.json"
   ```

### Step 3: Apply CORS configuration

Run the setup script:

```bash
node setup-cors.js
```

This will configure CORS for:
- `http://localhost:5194` (your current dev server)
- `http://localhost:3000` (common React dev server)
- `http://localhost:5000` (common backend server)
- `http://localhost:8080` (common Vue dev server)
- Your production domains (`https://zedloca.web.app`, `https://zedloca.firebaseapp.com`)

### Alternative: Manual CORS configuration

If you prefer to configure CORS manually via Firebase CLI:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize your project:
   ```bash
   firebase init
   ```

4. Use the Google Cloud Console to manually configure CORS:
   - Go to [Google Cloud Storage Browser](https://console.cloud.google.com/storage/browser)
   - Select your bucket
   - Click on "Edit bucket"
   - Add CORS configuration

### CORS Configuration Details

The CORS configuration allows:
- **Origins**: localhost development servers and production domains
- **Methods**: GET, POST, PUT, DELETE, HEAD, OPTIONS
- **Headers**: Content-Type, Access-Control-Allow-Origin, etc.
- **Max Age**: 1 hour (3600 seconds)

## Verification

After applying the CORS configuration:

1. Restart your development server
2. Try uploading an image again
3. Check the browser console for any remaining CORS errors

## Troubleshooting

### Still getting CORS errors?

1. **Verify bucket name**: Ensure the bucket name in `setup-cors.js` matches your Firebase Storage bucket
2. **Check credentials**: Ensure your Google Cloud service account has Storage Admin permissions
3. **Wait for propagation**: CORS changes may take a few minutes to propagate
4. **Clear browser cache**: Clear your browser cache and try again

### Permission denied errors?

1. Ensure your service account has the following roles:
   - Storage Admin
   - Storage Object Admin

2. Verify the service account key file path is correct in the environment variable

### Development server port changed?

Update the `cors.json` file to include your new port:

```json
{
  "origin": ["http://localhost:YOUR_NEW_PORT"],
  "method": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"],
  "maxAgeSeconds": 3600,
  "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers", "Access-Control-Max-Age"]
}
```

Then re-run:
```bash
node setup-cors.js
```

## Production Deployment

When deploying to production, ensure your production domains are included in the CORS configuration. The provided configuration already includes:
- `https://zedloca.web.app`
- `https://zedloca.firebaseapp.com`

If you use a custom domain, add it to the `cors.json` file and re-run the setup script.