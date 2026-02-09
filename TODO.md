# Ensure Promotions Are Per Listing

- [ ] Update Listings.jsx: Change promotion management to per listing instead of global seller promo. Load promo for each listing, update UI to edit promo per listing.
- [ ] Update EditPromotionModal.jsx: Modify to edit promotion for a specific listing (pass listingId prop).
- [ ] Update DraggableSidebar.jsx: Change to fetch active promotions from 'listings' collection instead of 'sellers'.
- [ ] Modify listing creation in Listings.jsx: When creating a listing, store lat, lng, and sellerDisplayName in the listing document.
- [ ] Test the changes: Verify promotions are per listing, location-based display works.
