import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// S3 Configuration
const s3Client = new S3Client({
  region: 'us-east-1', // Change to your preferred region
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || 'your-access-key',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || 'your-secret-key',
  },
});

const BUCKET_NAME = import.meta.env.VITE_S3_BUCKET_NAME || 'zedloca-listings';

/**
 * Upload file to S3 and return the URL
 * @param {File} file - The file to upload
 * @param {string} userId - The user ID for folder organization
 * @returns {Promise<string>} - The S3 URL of the uploaded file
 */
export async function uploadFileToS3(file, userId) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Generate unique filename
  const fileExtension = file.name.split('.').pop();
  const fileName = `${userId}/${uuidv4()}.${fileExtension}`;
  
  // Determine content type
  const contentType = file.type || 'application/octet-stream';

  try {
    // Upload file to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: file,
      ContentType: contentType,
      ACL: 'public-read', // Make file publicly accessible
    });

    await s3Client.send(command);
    
    // Return the public URL
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload file');
  }
}

/**
 * Generate a presigned URL for uploading files
 * @param {string} fileName - The name of the file
 * @param {string} contentType - The content type of the file
 * @param {string} userId - The user ID for folder organization
 * @returns {Promise<string>} - The presigned URL
 */
export async function getPresignedUploadUrl(fileName, contentType, userId) {
  const uniqueFileName = `${userId}/${uuidv4()}.${fileName.split('.').pop()}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: uniqueFileName,
    ContentType: contentType,
    ACL: 'public-read',
  });

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL expires in 1 hour
    return {
      url,
      key: uniqueFileName,
      publicUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${uniqueFileName}`
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * Validate file before upload
 * @param {File} file - The file to validate
 * @returns {Object} - Validation result
 */
export function validateFile(file) {
  const maxSize = 5 * 1024 * 1024; // 5MB limit
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/mov'
  ];

  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: 'File size must be less than 5MB' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type. Please upload JPEG, PNG, GIF, MP4, or MOV files.' };
  }

  return { isValid: true };
}

/**
 * Compress image before upload (basic implementation)
 * @param {File} file - The file to compress
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @returns {Promise<File>} - The compressed file
 */
export function compressImage(file, maxWidth = 800, maxHeight = 600) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image on canvas with new dimensions
      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas back to blob
      canvas.toBlob((blob) => {
        const compressedFile = new File([blob], file.name, {
          type: file.type,
          lastModified: Date.now()
        });
        resolve(compressedFile);
      }, file.type, 0.8); // 80% quality
    };

    img.src = URL.createObjectURL(file);
  });
}
