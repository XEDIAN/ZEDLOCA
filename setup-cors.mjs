import { Storage } from '@google-cloud/storage';
import { readFileSync } from 'fs';

const corsConfig = JSON.parse(readFileSync('./cors.json', 'utf8'));

async function setupCORS() {
  try {
    // Initialize Google Cloud Storage client
    const storage = new Storage();
    
    // Get the default bucket name from Firebase project
    const bucketName = 'verdant-task-v23ze.appspot.com';
    const bucket = storage.bucket(bucketName);
    
    // Set CORS configuration
    await bucket.setCorsConfiguration(corsConfig);
    
    console.log(`CORS configuration applied to bucket: ${bucketName}`);
    console.log('CORS configuration:', JSON.stringify(corsConfig, null, 2));
  } catch (error) {
    console.error('Error setting up CORS configuration:', error);
  }
}

// Run the setup
setupCORS();
