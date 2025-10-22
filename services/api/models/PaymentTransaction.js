const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    index: true
  },
  paymentId: {
    type: String,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
    required: true,
    index: true
  },
  method: String,
  description: String,
  razorpaySignature: String,
  eventId: String, // For webhook idempotency
  eventType: String, // payment.authorized, payment.captured, etc.
  metadata: mongoose.Schema.Types.Mixed,
  notes: mongoose.Schema.Types.Mixed,
  errorCode: String,
  errorDescription: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for finding transactions by user and status
paymentTransactionSchema.index({ userId: 1, status: 1 });

// Compound index for webhook idempotency checks
paymentTransactionSchema.index({ orderId: 1, eventId: 1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
