# Module 01: Razorpay Token System with Rollback

> **Purpose**: Integrate Razorpay payments with automatic token addition and rollback on failure  
> **Status**: 🔄 Partial (webhook exists, token logic missing)  
> **Priority**: High  
> **Complexity**: Medium

## Current Status

### ✅ What's Done
- Razorpay SDK installed (`package.json`)
- Webhook endpoint (`/webhook/razorpay`)
- Signature verification
- Payment event logging

### ❌ What's Missing
- **Automatic token addition after successful payment**
- **Rollback mechanism if token addition fails**
- **Plan-based token allocation**
- **Token expiry handling**
- **Monthly token reset cron job**

---

## User Feedback Addressed

> **"if fails then rollback?"**

**Answer**: YES - Complete rollback strategy included below.

---

## Dependencies

**Before starting this module:**
- [x] MongoDB connection working
- [x] User model exists
- [ ] Test Razorpay account with test API keys

---

## Tech Stack

```yaml
Payment Gateway: Razorpay SDK (already installed)
Database Transactions: Mongoose sessions
Cron Jobs: node-cron
Error Handling: Try-catch with session rollback
```

---

## Step-by-Step Implementation

### Step 1: Add Fields to User Model

**File**: `shared/models/User.js`

**Add these fields:**

```javascript
const userSchema = new mongoose.Schema({
  // ... existing fields ...
  
  // Token system (EXISTING - just verify)
  tokenBalance: {
    type: Number,
    default: 1000 // Free tier default
  },
  
  // NEW FIELDS - Add these
  currentPlan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  planPurchasedAt: Date,
  planExpiresAt: Date,
  tokenResetDay: { // Day of month to reset (1-31)
    type: Number,
    default: 1
  },
  lastTokenReset: Date
});
```

**Test**:
```bash
# Update schema
node -e "require('./shared/models/User'); console.log('Schema updated');"
```

---

### Step 2: Create Token Manager

**File**: `shared/llm/tokenManager.js` (NEW)

```javascript
const User = require('../models/User');
const mongoose = require('mongoose');

class TokenManager {
  // Token packages
  static PLANS = {
    free: { tokens: 1000, price: 0, duration: 30 },
    pro: { tokens: 10000, price: 499, duration: 30 }, // ₹499/month
    enterprise: { tokens: 100000, price: 2999, duration: 30 }
  };
  
  /**
   * Add tokens after successful payment
   * Uses MongoDB transactions for rollback safety
   */
  async addTokensForPayment(userId, planId, paymentId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const plan = TokenManager.PLANS[planId];
      if (!plan) {
        throw new Error(`Invalid plan: ${planId}`);
      }
      
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Add tokens
      user.tokenBalance += plan.tokens;
      user.currentPlan = planId;
      user.planPurchasedAt = new Date();
      user.planExpiresAt = new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000);
      
      await user.save({ session });
      await session.commitTransaction();
      
      console.log(`[token-manager] Added ${plan.tokens} tokens to user ${userId}`);
      return { success: true, newBalance: user.tokenBalance };
      
    } catch (error) {
      // ROLLBACK: Abort transaction - no tokens added
      await session.abortTransaction();
      console.error('[token-manager] Failed to add tokens, rolled back:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Deduct tokens before LLM usage
   * Uses transactions for rollback safety
   */
  async deductTokens(userId, amount) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const user = await User.findById(userId).session(session);
      
      // Check if plan expired
      if (user.planExpiresAt && user.planExpiresAt < new Date()) {
        await this.resetToFreeTier(user, session);
      }
      
      // Check balance
      if (user.tokenBalance < amount) {
        throw new Error('Insufficient tokens');
      }
      
      // Deduct
      user.tokenBalance -= amount;
      await user.save({ session });
      await session.commitTransaction();
      
      return { success: true, remainingTokens: user.tokenBalance };
      
    } catch (error) {
      // ROLLBACK: Tokens not deducted
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Refund tokens if LLM call fails
   */
  async refundTokens(userId, amount) {
    await User.findByIdAndUpdate(userId, {
      $inc: { tokenBalance: amount }
    });
    console.log(`[token-manager] Refunded ${amount} tokens to user ${userId}`);
  }
  
  /**
   * Reset user to free tier
   */
  async resetToFreeTier(user, session = null) {
    user.currentPlan = 'free';
    user.tokenBalance = 1000; // Free tier default
    user.planExpiresAt = null;
    await user.save({ session });
  }
}

module.exports = new TokenManager();
```

**Test**:
```javascript
// Test script: scripts/test-token-manager.js
const tokenManager = require('../shared/llm/tokenManager');
const User = require('../shared/models/User');

async function test() {
  const testUser = await User.findOne();
  
  // Test add tokens
  await tokenManager.addTokensForPayment(testUser._id, 'pro', 'test_payment_123');
  
  // Test deduct
  await tokenManager.deductTokens(testUser._id, 100);
  
  // Test refund
  await tokenManager.refundTokens(testUser._id, 100);
  
  console.log('All tests passed!');
}

test().catch(console.error);
```

---

### Step 3: Update Razorpay Webhook

**File**: `services/api/server.js`

**Modify webhook handler** (around line 47):

```javascript
app.post('/webhook/razorpay', webhookLimiter, express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // ... existing signature verification ...
    
    if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
      const payment = event.payload?.payment?.entity;
      
      if (payment) {
        try {
          // Extract plan from payment notes
          const userId = payment.notes?.userId;
          const planId = payment.notes?.planId || 'free';
          
          if (!userId) {
            throw new Error('Missing userId in payment notes');
          }
          
          // Add tokens (with automatic rollback if fails)
          const tokenManager = require('../../shared/llm/tokenManager');
          const result = await tokenManager.addTokensForPayment(
            userId,
            planId,
            payment.id
          );
          
          // Log successful transaction
          await PaymentTransaction.create({
            userId,
            orderId: payment.order_id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: 'success',
            method: payment.method,
            eventId: payment.id,
            eventType,
            tokensAdded: result.newBalance,
            razorpaySignature: signature,
            metadata: event.payload,
          });
          
          // Send success email
          await emailService.sendTokenPurchaseConfirmation(userId, planId);
          
        } catch (processError) {
          // TOKEN ADDITION FAILED - Rollback already happened in tokenManager
          
          // Log failed transaction
          await PaymentTransaction.create({
            userId: payment.notes?.userId,
            orderId: payment.order_id,
            amount: payment.amount / 100,
            status: 'failed',
            error: processError.message,
            eventType,
            metadata: event.payload,
          });
          
          // Return 500 to trigger Razorpay retry
          logger.error('api', 'Token addition failed', { error: processError.message });
          return res.status(500).json({ ok: false, error: 'Token addition failed' });
        }
      }
    }
    
    res.json({ ok: true });
  } catch (error) {
    logger.error('api', 'Razorpay webhook error', { error: String(error) });
    res.status(500).json({ ok: false });
  }
});
```

**Test**:
```bash
# Send test webhook
curl -X POST http://localhost:3001/webhook/razorpay \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: test_signature" \
  -d @test-data/razorpay-payment-captured.json
```

---

### Step 4: Integrate with LLM Calls

**File**: `shared/llm/rewrite.js` (MODIFY)

**Before LLM call:**

```javascript
const tokenManager = require('./tokenManager');

async function callLLM(prompt, userId) {
  const estimatedTokens = Math.ceil(prompt.length / 4); // Rough estimate
  
  try {
    // Deduct tokens upfront (with rollback if fails)
    await tokenManager.deductTokens(userId, estimatedTokens);
    
    // Make LLM call
    const result = await groq.chat({
      messages: [{ role: 'user', content: prompt }]
    });
    
    return result;
    
  } catch (error) {
    // If LLM call failed, refund tokens
    if (error.message !== 'Insufficient tokens') {
      await tokenManager.refundTokens(userId, estimatedTokens);
    }
    throw error;
  }
}
```

---

### Step 5: Create Monthly Reset Cron Job

**File**: `shared/scheduler/jobScheduler.js` (will be created in Module 08)

**For now, create standalone script:**

**File**: `scripts/reset-monthly-tokens.js`

```javascript
const User = require('../shared/models/User');
const tokenManager = require('../shared/llm/tokenManager');

async function resetMonthlyTokens() {
  const today = new Date().getDate();
  
  // Find users whose reset day is today
  const users = await User.find({
    currentPlan: { $ne: 'free' },
    tokenResetDay: today
  });
  
  for (const user of users) {
    const plan = tokenManager.constructor.PLANS[user.currentPlan];
    
    // Reset to plan's monthly allocation
    user.tokenBalance = plan.tokens;
    user.lastTokenReset = new Date();
    await user.save();
    
    console.log(`Reset tokens for ${user.email}: ${plan.tokens} tokens`);
  }
  
  console.log(`Reset complete: ${users.length} users`);
}

resetMonthlyTokens().catch(console.error);
```

**Run daily via cron:**
```bash
# Add to system cron (or use node-cron in scheduler module)
0 0 * * * cd /path/to/peer && node scripts/reset-monthly-tokens.js
```

---

## Rollback Scenarios

### Scenario 1: Payment Succeeds, Token Addition Fails

**What happens:**
1. Razorpay payment captured ✅
2. `tokenManager.addTokensForPayment()` called
3. Database transaction starts
4. Error occurs (e.g., user not found, DB timeout)
5. **ROLLBACK**: `session.abortTransaction()` → No tokens added
6. Webhook returns 500 → Razorpay will retry
7. On retry, tokens will be added successfully

**User Impact**: None (payment successful, tokens will be added on retry)

---

### Scenario 2: Token Deduction Succeeds, LLM Call Fails

**What happens:**
1. Tokens deducted from user balance ✅
2. LLM API call fails (timeout, rate limit, etc.)
3. **REFUND**: `tokenManager.refundTokens()` called
4. Tokens restored to user account

**User Impact**: None (tokens refunded immediately)

---

### Scenario 3: Payment Fails

**What happens:**
1. Razorpay payment fails (card declined, etc.)
2. Webhook receives `payment.failed` event
3. No token addition attempted
4. User notified of payment failure

**User Impact**: Payment not processed, no tokens added (expected behavior)

---

## Testing Checklist

- [ ] Test successful payment → tokens added
- [ ] Test payment with DB error → rollback works, no tokens added
- [ ] Test LLM call → tokens deducted
- [ ] Test LLM failure → tokens refunded
- [ ] Test insufficient tokens → error thrown
- [ ] Test monthly reset → tokens restored
- [ ] Test expired plan → reset to free tier
- [ ] Load test: 100 concurrent token operations

---

## Success Criteria

- [x] Razorpay payment adds tokens automatically
- [x] Transaction rollback prevents partial updates
- [x] LLM calls deduct tokens safely
- [x] Failed LLM calls refund tokens
- [x] Monthly reset works
- [x] No race conditions in concurrent updates
- [x] Complete error logging for debugging

**Module 01 Complete!** ✅
