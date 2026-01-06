# Enable Navigation Between Sellers and Buyers via Google Maps

## Current Status
- Buyers can navigate to sellers using MapSellers.jsx (already implemented)
- Sellers cannot navigate to buyers because buyer locations are not stored

## Plan
1. Modify messaging components to capture and store buyer locations
2. Create MapBuyers component for sellers to view buyers on map
3. Add navigation buttons for sellers to navigate to buyers
4. Update SellerInbox to include navigation to buyers
5. Test the implementation

## Steps
- [x] Update MessageSellerModal to capture buyer location when sending message
- [x] Store buyer location in messages or create buyers collection
- [x] Create MapBuyers.jsx component similar to MapSellers.jsx
- [x] Integrate MapBuyers into seller interface
- [x] Add navigation buttons in SellerInbox for buyers
- [x] Update Firebase rules if needed (No changes required - existing rules allow access)
