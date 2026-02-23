import React, { useState, useRef } from 'react';
import { uploadImageToFirebase } from '../utils/firebaseStorageUpload';
import { validateFile, compressImage } from '../utils/s3Upload';

/**
 * Image Upload Component
 * @param {Object} props
 * @param {Function} props.onUpload - Callback when file is uploaded
 * @param {Function} props.onError - Callback when error occurs
 * @param {string} props.userId - Current user ID
 * @param {string} props.accept - Accepted file types (default: images and videos)
 * @param {boolean} props.multiple - Allow multiple file uploads
 * @param {number} props.maxFiles - Maximum number of files (default: 5)
 */
function ImageUpload({ onUpload, onError = () => {}, userId, accept = "image/*,video/*", multiple = false, maxFiles = 5 }) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    
    // Validate files
    for (const file of fileArray) {
      const validation = validateFile(file);
      if (!validation.isValid) {
        onError(validation.error);
        return;
      }
    }

    setUploading(true);

    try {
      const uploadPromises = fileArray.map(async (file) => {
        // Compress image if it's an image file
        const fileToUpload = file.type.startsWith('image/') ? await compressImage(file) : file;
        
        const url = await uploadImageToFirebase(fileToUpload, userId);
        return { file, url, type: file.type };
      });

      const results = await Promise.all(uploadPromises);
      
      // Update state with new files
      setFiles(prev => [...prev, ...results]);
      onUpload(results);
      
      // Create preview URLs for images
      const newPreviewUrls = fileArray
        .filter(file => file.type.startsWith('image/'))
        .map(file => URL.createObjectURL(file));
      
      setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
      
    } catch (error) {
      console.error('Upload failed:', error);
      onError(error.message || 'Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileSelect(selectedFiles);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviewUrls = previewUrls.filter((_, i) => i !== index);
    
    setFiles(newFiles);
    setPreviewUrls(newPreviewUrls);
    
    // Revoke object URL to free memory
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple && files.length < maxFiles}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors ${
          uploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-600">Uploading files...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="text-4xl mb-2">📁</div>
            <p className="text-gray-600 mb-2">
              Drag and drop files here, or click to select files
            </p>
            <p className="text-xs text-gray-500">
              Supported: JPEG, PNG, GIF, MP4, MOV (Max 5MB each)
            </p>
            {multiple && (
              <p className="text-xs text-gray-500 mt-1">
                {files.length}/{maxFiles} files uploaded
              </p>
            )}
          </div>
        )}
      </div>

      {/* Preview Grid */}
      {previewUrls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg"
              />
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File List for non-images */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileData, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium">
                  {fileData.file.name}
                </span>
                <span className="text-xs text-gray-500">
                  {fileData.type}
                </span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImageUpload;
