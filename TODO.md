# TODO: Seller Profile Link Sharing

## Tasks
- [x] Add URL parameter handling in App.jsx for /seller/SELLER_ID to show seller profile for buyers
- [x] Add share buttons in SellerProfile.jsx for WhatsApp and phone message
- [x] Test the link sharing functionality
- [x] Update shared seller links to show listings and contact details instead of profile
- [x] Update link format in SellerProfile.jsx from query parameter to path-based URL (/seller/${sellerId})
  - [x] Update handleShareWhatsApp function
  - [x] Update handleShareSMS function
  - [x] Update handleCopyLink function
  - [x] Update displayed link in Share Your Store section
- [x] Create linkUtils.js for environment-aware URL generation
- [x] Add setNgrokUrl function for dynamic ngrok URL configuration
- [x] Add console instructions for setting ngrok URL
- [x] Ensure localhost links are pre-tunneled by ngrok for accessibility before deployment
  - [x] Create linkUtils.js utility for environment-aware URL generation
  - [x] Update SellerProfile.jsx to use ngrok URLs in development

## Sidebar Toggle Restriction for Sellers
- [x] Modify DraggableSidebar.jsx to disable swipe and drag gestures for sellers (role === 'seller')
- [x] Ensure only the toggle button controls sidebar open/close for sellers
- [x] Keep swipe and drag functionality for buyers
- [x] Test sidebar behavior for both roles
