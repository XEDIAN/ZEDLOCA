import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Sends an automated notification to the seller when a buyer places an order.
 * This creates a message in the seller's inbox with order details.
 * 
 * @param {string} sellerId - The seller's user ID
 * @param {string} sellerName - The seller's display name
 * @param {object} buyer - The buyer object (with uid, displayName, email)
 * @param {object} listing - The listing being ordered (with id, title, price)
 * @param {number} quantity - Order quantity
 * @param {string} deliveryAddress - Delivery address
 * @param {string} specialInstructions - Any special instructions
 */
export async function sendOrderNotificationToSeller({
  sellerId,
  sellerName,
  buyer,
  listing,
  quantity,
  deliveryAddress,
  specialInstructions
}) {
  try {
    // Calculate total price
    const itemPrice = parseFloat(listing.price.replace(/[^0-9.-]+/g, ''));
    const totalPrice = itemPrice * quantity;

    // Create a prefilled message with order details
    const message = `🛒 NEW ORDER RECEIVED!

Customer: ${buyer.displayName || 'Customer'}
Email: ${buyer.email || 'Not provided'}

📦 Order Details:
- Item: ${listing.title}
- Quantity: ${quantity}
- Price per item: $${itemPrice.toFixed(2)}
- Total: $${totalPrice.toFixed(2)}

📍 Delivery Address:
${deliveryAddress}

${specialInstructions ? `📝 Special Instructions:\n${specialInstructions}\n` : ''}

Please contact the customer to arrange delivery.`;

    // Add the message to the messages collection
    // This will appear in the seller's inbox (SellerInbox)
    await addDoc(collection(db, 'messages'), {
      sellerId: sellerId,
      buyerId: buyer.uid,
      buyerName: buyer.displayName || 'Customer',
      buyerEmail: buyer.email || '',
      message: message,
      timestamp: serverTimestamp(),
      read: false,
      fromSeller: false,
      isOrderNotification: true, // Flag to identify order notifications
      orderDetails: {
        listingId: listing.id,
        listingTitle: listing.title,
        quantity: quantity,
        totalPrice: totalPrice,
        deliveryAddress: deliveryAddress,
        specialInstructions: specialInstructions
      }
    });

    console.log('Order notification sent to seller successfully');
    return true;
  } catch (error) {
    console.error('Error sending order notification to seller:', error);
    // Don't throw - order should still be placed even if notification fails
    return false;
  }
}
