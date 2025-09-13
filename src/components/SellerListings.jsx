import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';

function SellerListings({ sellerId, onBack }) {
  const [seller, setSeller] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;

    // Fetch seller profile
    const fetchSellerProfile = async () => {
      try {
        const sellerDoc = await getDoc(doc(db, 'sellers', sellerId));
        if (sellerDoc.exists()) {
          setSeller(sellerDoc.data());
        }
      } catch (err) {
        console.error('Error fetching seller profile:', err);
      }
    };

    // Fetch seller listings ordered by newest first (requires composite index: userId asc + createdAt desc)
    const q = query(
      collection(db, 'listings'),
      where('userId', '==', sellerId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubListings = onSnapshot(q, (snapshot) => {
      // With Firestore ordering, map directly
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(docs);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching listings:', error);
      setLoading(false);
    });

    fetchSellerProfile();

    return () => unsubListings();
  }, [sellerId]);

  if (loading) {
    return (
  <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 mt-16">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
  <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
      <div className="flex-1 flex flex-col items-center justify-center pb-32">
        {seller ? (
          <div className="w-full max-w-2xl mt-8">
            <div className="flex items-center mb-6 p-4 bg-white rounded shadow">
              {seller.photoURL && (
                <img src={seller.photoURL} alt={seller.displayName} className="w-16 h-16 rounded-full mr-4" />
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{seller.displayName}</h2>
                <p className="text-gray-700">{seller.email}</p>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Store Listings</h3>
            
            {listings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map(listing => (
                  <div key={listing.id} className="border rounded p-4 bg-white shadow">
                    {listing.image && (
                      listing.mediaType === 'video' ? (
                        <video src={listing.image} controls className="w-full h-32 object-cover rounded mb-2" />
                      ) : (
                        <img src={listing.image} alt={listing.title} className="w-full h-32 object-cover rounded mb-2" />
                      )
                    )}
                    <h4 className="font-bold">{listing.title}</h4>
                    <p className="text-gray-700 font-semibold">{listing.price}</p>
                    <p className="text-gray-600 text-sm">{listing.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">This seller has no listings yet.</p>
            )}
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Seller not found</h2>
            <p className="text-gray-600">The requested seller profile could not be loaded.</p>
          </div>
        )}
      </div>
      
  <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 text-white py-4 flex justify-center gap-4 z-50">
        <button
          className="bg-white text-gray-800 font-bold px-6 py-2 rounded shadow hover:bg-gray-200 transition"
          onClick={onBack}
        >
          Back to Map
        </button>
      </footer>
    </div>
  );
}

export default SellerListings;