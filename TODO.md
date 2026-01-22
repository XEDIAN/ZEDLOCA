# TODO: Ensure Buyer and Seller Profile Information in Orders

## Current Status
- Buyer profiles stored in 'buyers' collection: occupation, phone, bio, preferences
- Seller profiles stored in 'sellers' collection: storeName, displayName, email, phone, description, address, city, state, zipCode, website, categories, paymentMethods, deliveryOptions, location, photoURL, coverPhotoURL
- Orders currently store minimal info: buyerId, buyerName, buyerEmail, sellerId, sellerName, sellerEmail

## Tasks
- [ ] Update PlaceOrderPage.jsx to fetch and store full buyer and seller profile data in orders
- [ ] Update BuyerOrders.jsx to display buyer and seller profile information
- [ ] Update BuyerMyOrders.jsx to display buyer and seller profile information
- [ ] Test order placement and display functionality
