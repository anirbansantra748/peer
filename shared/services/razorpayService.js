const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../utils/prettyLogger');

// Initialize Razorpay instance
logger.info('razorpay', 'Initializing Razorpay SDK', {
  hasKeyId: !!process.env.RAZORPAY_KEY_ID,
  hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
  keyIdPrefix: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.substring(0, 8) : 'missing'
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay order for Pro tier purchase
 * @param {Object} user - User object
 * @param {number} amount - Amount in INR (e.g., 800)
 * @returns {Object} Razorpay order
 */
async function createProOrder(user, amount = 800) {
  try {
    // Validate Razorpay credentials
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured in environment variables');
    }

    const options = {
      amount: amount * 100, // Amount in paise (800 * 100 = 80000 paise)
      currency: 'INR',
      receipt: `pro_${Date.now()}_${user._id.toString().slice(-8)}`, // Max 40 chars
      notes: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        tier: 'pro',
        tokens: 10000,
      },
    };

    const order = await razorpay.orders.create(options);
    
    logger.info('razorpay', 'Order created', {
      orderId: order.id,
      userId: user._id,
      amount,
    });

    return order;
  } catch (error) {
    // Razorpay errors have nested structure
    const errorDetails = {
      message: error.message || String(error),
      statusCode: error.statusCode,
      errorCode: error.error?.code,
      errorDescription: error.error?.description,
      errorField: error.error?.field,
      errorReason: error.error?.reason,
      errorSource: error.error?.source,
      errorStep: error.error?.step,
      fullError: JSON.stringify(error.error || error, null, 2),
      userId: user._id,
    };
    logger.error('razorpay', 'Failed to create order', errorDetails);
    throw new Error(error.error?.description || error.message || 'Failed to create Razorpay order');
  }
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {boolean} True if signature is valid
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  try {
    const text = orderId + '|' + paymentId;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    return generatedSignature === signature;
  } catch (error) {
    logger.error('razorpay', 'Signature verification failed', {
      error: error.message,
    });
    return false;
  }
}

/**
 * Verify webhook signature from Razorpay
 * @param {string} body - Request body as string
 * @param {string} signature - Razorpay signature from header
 * @returns {boolean} True if signature is valid
 */
function verifyWebhookSignature(body, signature) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    logger.error('razorpay', 'Webhook signature verification failed', {
      error: error.message,
    });
    return false;
  }
}

/**
 * Fetch payment details from Razorpay
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Object} Payment details
 */
async function fetchPayment(paymentId) {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    logger.error('razorpay', 'Failed to fetch payment', {
      error: error.message,
      paymentId,
    });
    throw error;
  }
}

/**
 * Process successful payment and upgrade user
 * @param {Object} payment - Payment object from Razorpay
 * @returns {Object} Updated user
 */
async function processSuccessfulPayment(payment) {
  try {
    const User = require('../models/User');
    const { notifyUserError } = require('../utils/errorNotification');

    const userId = payment.notes.userId;
    const tokens = parseInt(payment.notes.tokens) || 10000;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Add purchased tokens (these don't expire)
    user.purchasedTokens = (user.purchasedTokens || 0) + tokens;
    user.subscriptionTier = 'pro';
    user.subscriptionStatus = 'active';

    await user.save();

    logger.info('razorpay', 'User upgraded successfully', {
      userId: user._id,
      tokensAdded: tokens,
      totalPurchasedTokens: user.purchasedTokens,
    });

    // Send success notification
    await notifyUserError({
      userId: user._id,
      type: 'payment_success',
      title: '✅ Payment Successful!',
      message: `You've received ${tokens.toLocaleString()} tokens. Start using them now!`,
      link: '/',
      sendEmail: true,
    });

    return user;
  } catch (error) {
    logger.error('razorpay', 'Failed to process payment', {
      error: error.message,
      paymentId: payment.id,
    });
    throw error;
  }
}

module.exports = {
  createProOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  processSuccessfulPayment,
};
