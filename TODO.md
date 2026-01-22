# TODO: Add Navigation Button in SellerInbox for Shared Locations

## Tasks
- [x] Modify SellerInbox.jsx to display "Navigate" button for messages with buyerLat and buyerLng
- [x] Implement navigation logic to open Google Maps directions from seller's location to buyer's shared location
- [ ] Test the functionality to ensure button appears only for relevant messages

## Information Gathered
- Messages in Firestore have buyerLat and buyerLng fields when location is shared
- Navigation logic exists in MessageSellerModal.jsx and can be reused
- SellerInbox displays messages in conversation view

## Plan Details
- Add conditional rendering of navigation button in message display
- Button should appear for buyer messages (not fromSeller) that have location data
- Use geolocation to get seller's current location for directions
- Fallback to destination-only URL if geolocation fails
