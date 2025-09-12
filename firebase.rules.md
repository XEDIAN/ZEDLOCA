rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Listings: anyone can read, only the owner can write their own listing
    match /listings/{id} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    // Sellers profile doc stored by your app on sign-in/map usage
    match /sellers/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    // Default reads for other public docs if needed
    match /{document=**} {
      allow read: if true;
    }
  }
}