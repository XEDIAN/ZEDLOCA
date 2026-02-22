import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload an image file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} userId - The user ID for folder organization
 * @returns {Promise<string>} - The download URL of the uploaded file
 */
export async function uploadImageToFirebase(file, userId) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Generate unique filename
  const fileExtension = file.name.split('.').pop();
  const fileName = `${userId}/${uuidv4()}.${fileExtension}`;
  
  // Create storage reference
  const storageRef = ref(storage, fileName);
  
  // Determine content type
  const contentType = file.type || 'application/octet-stream';

  try {
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: contentType,
    });
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file to Firebase Storage:', error);
    throw new Error('Failed to upload file to Firebase Storage');
  }
}

/**
 * Upload multiple images to Firebase Storage
 * @param {File[]} files - Array of files to upload
 * @param {string} userId - The user ID for folder organization
 * @returns {Promise<string[]>} - Array of download URLs
 */
export async function uploadMultipleImagesToFirebase(files, userId) {
  if (!files || files.length === 0) {
    return [];
  }

  const uploadPromises = files.map(file => uploadImageToFirebase(file, userId));
  
  try {
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    throw error;
  }
}

/**
 * Delete an image from Firebase Storage
 * @param {string} imageUrl - The download URL of the image to delete
 * @returns {Promise<void>}
 */
export async function deleteImageFromFirebase(imageUrl) {
  if (!imageUrl) {
    return;
  }

  try {
    // Extract the path from the Firebase Storage URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}
    let filePath = imageUrl;
    
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
      // Extract the path after '/o/'
      const match = imageUrl.match(/o\/(.+)$/);
      if (match && match[1]) {
        // Decode the URL-encoded path
        filePath = decodeURIComponent(match[1]);
      }
    } else if (imageUrl.includes('/listings/')) {
      // Fallback: try to extract the path directly
      filePath = imageUrl.split('/listings/')[1];
    }
    
    console.log('Deleting image from path:', filePath);
    const imageRef = ref(storage, `listings/${filePath}`);
    await deleteObject(imageRef);
  } catch (error) {
    console.error('Error deleting image from Firebase Storage:', error);
    // Don't throw - deletion failure shouldn't block operations
  }
}
