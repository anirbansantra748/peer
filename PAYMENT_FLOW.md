# Peer Payment Flow Documentation

## ✅ Payment Model

**₹800 = 10,000 tokens**
- Users can purchase **unlimited times** (no monthly limit)
- Tokens **never expire**
- Tokens stack with existing balance
- Payment processed via Razorpay

---

## 🔄 Complete Payment Flow

### 1. User Initiates Purchase
- User visits `/settings/subscription`
- Clicks "Buy 10,000 Tokens" button
- Frontend sends POST to `/settings/subscription/razorpay/order`

### 2. Order Creation
**Endpoint:** `POST /settings/subscription/razorpay/order`
- **Rate Limited:** 5 requests per 15 minutes
- **Handler:** `createProOrder()` in `razorpayService.js`
- **Actions:**
  1. Creates Razorpay order with ₹800 (80,000 paise)
  2. Logs transaction in `PaymentTransaction` model (status: 'created')
  3. Returns order details to frontend

### 3. Razorpay Checkout Modal
- Frontend opens Razorpay modal with:
  - Order ID
  - Amount: ₹800
  - User prefill (name, email)
  - Success handler configured

### 4. Payment by User
- User completes payment via Razorpay
- Payment methods: Cards, UPI, Netbanking, Wallets
- Razorpay processes payment securely

### 5. Frontend Verification
**Endpoint:** `POST /settings/subscription/razorpay/verify`
- **Rate Limited:** 5 requests per 15 minutes
- **Handler:** `verifyPaymentSignature()` in `razorpayService.js`
- **Validation:**
  1. Verifies Razorpay signature (SHA256 HMAC)
  2. Fetches payment details from Razorpay
  3. Checks payment status (captured/authorized)

### 6. Token Credit (Success Flow)
**Handler:** `processSuccessfulPayment()` in `razorpayService.js`
- **Actions:**
  1. Add 10,000 to `user.purchasedTokens`
  2. Set `user.subscriptionTier = 'pro'`
  3. Set `user.subscriptionStatus = 'active'`
  4. Save user to database
  5. Log transaction in `PaymentTransaction` (status: 'captured')
  6. Send success notification to user (toast + email)
  7. Send admin notification email with payment details
  8. Redirect to `/settings/subscription?success=Payment+successful`

### 7. Webhook (Background Verification)
**Endpoint:** `POST /webhook/razorpay`
- **Rate Limited:** 100 requests per minute
- **Signature Verification:** Required
- **Idempotency:** Checks `eventId + orderId` to prevent duplicates
- **Events Handled:**
  - `payment.captured`
  - `payment.authorized`
- **Actions:**
  1. Verify webhook signature
  2. Check for duplicate events (idempotency)
  3. Process payment if not already processed
  4. Log webhook event in `PaymentTransaction`
  5. On failure: Log error, return 500 (triggers Razorpay retry)

---

## 📄 Pages & Routes

### User-Facing Pages
| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/settings/subscription` | Buy tokens, view plans | ✅ Yes |
| `/settings/transactions` | View payment history | ✅ Yes |
| `/support` | Contact support, FAQ | ✅ Yes |
| `/terms` | Terms of Service | ❌ No |
| `/privacy` | Privacy Policy | ❌ No |

### API Endpoints
| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/settings/subscription/razorpay/order` | POST | Create payment order | 5/15min |
| `/settings/subscription/razorpay/verify` | POST | Verify payment | 5/15min |
| `/webhook/razorpay` | POST | Process webhooks | 100/min |
| `/api/user/usage` | GET | Get token usage stats | 30/min |
| `/settings/transactions` | GET | Fetch transaction history | - |

---

## 💾 Database Models

### User Model (`shared/models/User.js`)
```javascript
{
  purchasedTokens: Number,  // Tokens bought (never expire)
  tokensUsed: Number,        // Tokens consumed
  subscriptionTier: String,  // 'free' | 'pro' | 'enterprise'
  subscriptionStatus: String // 'active' | 'expired' | 'cancelled'
}
```

### PaymentTransaction Model (`services/api/models/PaymentTransaction.js`)
```javascript
{
  userId: ObjectId,
  orderId: String,           // Razorpay order ID
  paymentId: String,         // Razorpay payment ID
  amount: Number,            // Amount in INR
  status: String,            // 'created' | 'captured' | 'failed'
  eventId: String,           // For idempotency
  eventType: String,         // Webhook event type
  razorpaySignature: String,
  metadata: Mixed,
  createdAt: Date
}
```

**Indexes:**
- `userId` (indexed)
- `orderId` (indexed)
- `paymentId` (indexed)
- `status` (indexed)
- `userId + status` (compound)
- `orderId + eventId` (compound, for idempotency)

---

## 🔐 Security Features

### 1. Signature Verification
- All payments verified with SHA256 HMAC
- Uses `RAZORPAY_KEY_SECRET` for verification
- Invalid signatures rejected

### 2. Rate Limiting
- Payment endpoints: 5 requests per 15 minutes
- Webhook: 100 requests per minute
- API endpoints: 30 requests per minute

### 3. Idempotency
- Webhook events checked for duplicates
- Prevents double-crediting tokens
- Uses `eventId + orderId` composite check

### 4. Transaction Logging
- All payment attempts logged
- Failed payments recorded with error details
- Audit trail for disputes

---

## 🚀 Production Checklist

### Environment Variables
```bash
# Required
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
ADMIN_EMAIL=your@email.com

# Optional
NODE_ENV=production
APP_VERSION=1.0.0
```

### Razorpay Setup
1. **Switch to Live Mode** in Razorpay Dashboard
2. **Get Live Keys** (replace test keys)
3. **Configure Webhook** at: `https://yourapp.com/webhook/razorpay`
4. **Enable Events:** `payment.captured`, `payment.authorized`, `payment.failed`
5. **Set Webhook Secret**

### Testing Flow
1. ✅ Create order
2. ✅ Complete payment (test mode)
3. ✅ Verify signature
4. ✅ Check tokens credited
5. ✅ Verify webhook received
6. ✅ Check transaction logged
7. ✅ Test idempotency (duplicate webhook)
8. ✅ Test failure handling

---

## 📊 Monitoring

### Health Checks
- `/health` - Basic health status
- `/healthz` - Detailed health with DB status

### Logs to Monitor
- Payment creation failures
- Signature verification failures
- Webhook processing errors
- Token crediting failures
- Admin email failures

### Razorpay Dashboard
- Check webhook delivery status
- Monitor failed payments
- Review dispute cases

---

## 🔧 Troubleshooting

### Payment Not Completing
1. Check Razorpay Dashboard for payment status
2. Verify webhook is being delivered
3. Check server logs for errors
4. Verify signature is correct

### Tokens Not Credited
1. Check `PaymentTransaction` for entry
2. Verify payment status in Razorpay
3. Check user's `purchasedTokens` field
4. Manually credit if needed:
```javascript
user.purchasedTokens += 10000;
user.subscriptionTier = 'pro';
await user.save();
```

### Duplicate Transactions
- Idempotency checks prevent this
- If occurs, check `PaymentTransaction` for duplicates
- Manually deduct excess tokens if needed

---

## 📞 Support

**Payment Issues:**
- Email: anirbansantra748@gmail.com
- Support Page: `/support`
- Response Time: 24-48 hours

**Refund Policy:**
- 7 days from purchase
- Less than 20% tokens used
- Full refund minus gateway fees (2-3%)
- Process time: 5-7 business days
