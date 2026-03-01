/**
 * Voice Recording Utility
 * Handles audio recording for voice notes in messaging
 */

let mediaRecorder = null;
let audioChunks = [];
let stream = null;

/**
 * Check if browser supports audio recording
 * @returns {boolean}
 */
export function isAudioRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Start recording audio
 * @returns {Promise<void>}
 */
export async function startRecording() {
  if (!isAudioRecordingSupported()) {
    throw new Error('Audio recording is not supported in this browser');
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.addEventListener('dataavailable', (event) => {
      audioChunks.push(event.data);
    });

    mediaRecorder.start();
    return true;
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
}

/**
 * Stop recording and return the audio blob
 * @returns {Promise<Blob>}
 */
export async function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error('No recording in progress'));
      return;
    }

    mediaRecorder.addEventListener('stop', () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      // Stop all tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      audioChunks = [];
      mediaRecorder = null;
      stream = null;
      
      resolve(audioBlob);
    });

    mediaRecorder.stop();
  });
}

/**
 * Cancel recording and clean up
 */
export function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  
  audioChunks = [];
  mediaRecorder = null;
  stream = null;
}

/**
 * Check if currently recording
 * @returns {boolean}
 */
export function isRecording() {
  return mediaRecorder && mediaRecorder.state === 'recording';
}

/**
 * Upload audio file to Firebase Storage
 * @param {File} audioFile - The audio file to upload
 * @param {string} userId - The user ID for folder organization
 * @returns {Promise<string>} - The download URL of the uploaded audio
 */
export async function uploadVoiceNoteToFirebase(audioFile, userId) {
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const { storage } = await import('../firebase');
  const { v4: uuidv4 } = await import('uuid');

  if (!audioFile) {
    throw new Error('No audio file provided');
  }

  // Generate unique filename
  const fileExtension = 'webm';
  const fileName = `voice_notes/${userId}/${uuidv4()}.${fileExtension}`;
  
  // Create storage reference
  const storageRef = ref(storage, fileName);
  
  // Determine content type
  const contentType = audioFile.type || 'audio/webm';

  try {
    // Upload the file
    const snapshot = await uploadBytes(storageRef, audioFile, {
      contentType: contentType,
    });
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading voice note to Firebase Storage:', error);
    throw new Error('Failed to upload voice note');
  }
}

/**
 * Convert audio blob to WAV format (for better compatibility)
 * @param {Blob} audioBlob - The audio blob to convert
 * @returns {Promise<Blob>} - The converted audio blob
 */
export async function convertToWav(audioBlob) {
  // For now, return the original blob
  // In production, you could use a library like lamejs to convert to MP3
  // or wav.js for WAV conversion
  return audioBlob;
}
