const { Storage } = require('@google-cloud/storage');
const corsConfig = require('./cors.json');

async function setupCORS() {
  try {
    // Initialize Google Cloud Storage client
    const storage = new Storage();
    
    // Get the default bucket name from Firebase project
    // You'll need to replace this with your actual bucket name
    const bucketName = 'zedloca.appspot.com';
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