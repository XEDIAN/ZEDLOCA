import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { uploadImageToFirebase } from '../utils/firebaseStorageUpload';

/**
 * Props:
 * - open: boolean
 * - onClose: function
 * - sellerId: string
 * - buyerId: string
 * - originalMessageId: string
 */
function ReplyToSellerModal({ open, onClose, sellerId, buyerId, originalMessageId }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [buyerLocation, setBuyerLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  if (!open) return null;

  const handleLocationCapture = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuyerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocationError('Unable to get location: ' + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
    );
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedImages.length > 5) {
      setError('Maximum 5 images allowed per message');
      return;
    }
    // Create preview URLs
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setSelectedImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index) => {
    const newImages = [...selectedImages];
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    setSelectedImages(newImages);
  };

  const uploadImages = async (files) => {
    const urls = [];
    for (const file of files) {
      const url = await uploadImageToFirebase(file, buyerId);
      urls.push(url);
    }
    return urls;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess(false);

    try {
      let imageUrls = [];
      
      // Upload images if any
      if (selectedImages.length > 0) {
        setUploadingImages(true);
        try {
          imageUrls = await uploadImages(selectedImages.map(img => img.file));
        } catch (uploadErr) {
          setError('Failed to upload images: ' + uploadErr.message);
          setSending(false);
          setUploadingImages(false);
          return;
        }
        setUploadingImages(false);
      }

      await addDoc(collection(db, 'messages'), {
        sellerId,
        buyerId,
        replyTo: originalMessageId,
        message: reply,
        fromSeller: false,
        buyerLat: buyerLocation?.lat || null,
        buyerLng: buyerLocation?.lng || null,
        imageUrls: imageUrls,
        timestamp: serverTimestamp(),
        read: false,
      });
      setSuccess(true);
      setReply('');
      setBuyerLocation(null);
      setSelectedImages([]);
    } catch (err) {
      setError('Failed to send reply: ' + err.message);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">Reply to Seller</h2>
        <form onSubmit={handleSend}>
          <textarea
            className="w-full border rounded p-2 mb-2"
            rows={4}
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Type your reply..."
            required
            disabled={sending}
          />

          {/* Image Upload */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 mb-2">Share Images (Optional)</h3>
            <p className="text-sm text-gray-600 mb-2">Add images to your message (max 5)</p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
              id="image-upload-reply"
              disabled={sending || selectedImages.length >= 5}
            />
            <label
              htmlFor="image-upload-reply"
              className={`inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm cursor-pointer ${sending || selectedImages.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              📷 Add Images
            </label>
            
            {/* Image Previews */}
            {selectedImages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedImages.map((img, index) => (
                  <div key={index} className="relative">
                    <img
                      src={img.preview}
                      alt={`Preview ${index + 1}`}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      disabled={sending}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location Sharing */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 mb-2">Share Your Location (Optional)</h3>
            <p className="text-sm text-gray-600 mb-2">Allow the seller to see your location for easier navigation.</p>
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <button
                type="button"
                onClick={handleLocationCapture}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                disabled={sending}
              >
                📍 Share Location
              </button>
              {buyerLocation && (
                <span className="text-sm text-green-600">
                  ✓ Location captured: {buyerLocation.lat.toFixed(4)}, {buyerLocation.lng.toFixed(4)}
                </span>
              )}
            </div>
            {locationError && (
              <p className="text-red-600 text-sm mt-1">{locationError}</p>
            )}
          </div>

          {error && <div className="text-red-600 mb-2">{error}</div>}
          {success && <div className="text-green-600 mb-2">Reply sent!</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-1 rounded bg-gray-300" onClick={onClose} disabled={sending}>Cancel</button>
            <button type="submit" className="px-4 py-1 rounded bg-blue-600 text-white" disabled={sending || !reply.trim() || uploadingImages}>
              {sending ? (uploadingImages ? 'Uploading...' : 'Sending...') : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReplyToSellerModal;
