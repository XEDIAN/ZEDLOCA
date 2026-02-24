# TODO - Full Resolution Image Viewing Feature

## Task
When users click on images, they should be able to view them in full resolution.

## Implementation Plan

### Step 1: Create ImageLightbox Component
- [ ] Create `src/components/ImageLightbox.jsx` with:
  - Modal overlay with full-resolution image
  - Close button (X)
  - Backdrop click to close
  - Navigation (previous/next) for multiple images
  - Image counter display
  - Keyboard support (Escape to close, Arrow keys for navigation)

### Step 2: Update SellerListings.jsx
- [ ] Import ImageLightbox component
- [ ] Add state for lightbox (isOpen, currentImageIndex, images array)
- [ ] Add click handler to images to open lightbox
- [ ] Add Image to renderLightbox component

### Step 3: Update BuyerStores.jsx
- [ ] Import ImageLightbox component
- [ ] Add state for lightbox
- [ ] Add click handlers to all image displays
- [ ] Add ImageLightbox component to render

### Step 4: Update Listings.jsx
- [ ] Import ImageLightbox component
- [ ] Add state for lightbox
- [ ] Add click handler to images
- [ ] Add ImageLightbox component to render

## Status: In Progress
