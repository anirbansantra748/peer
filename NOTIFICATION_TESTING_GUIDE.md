# Notification System Testing Guide

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Email (Optional but Recommended)
Add to your `.env` file:
```env
# SMTP Configuration (use Gmail, SendGrid, Mailgun, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=Peer Code Review <your_email@gmail.com>
APP_URL=http://localhost:3000

# If using Gmail, create an App Password:
# https://myaccount.google.com/apppasswords
```

### 3. Start Services
```bash
# Terminal 1: Start Redis and MongoDB
npm run dev:infra

# Terminal 2: Start API
npm run dev:api

# Terminal 3: Start UI
npm run dev:ui

# Terminal 4: Start Analyzer Worker
npm run dev:analyzer

# Terminal 5: Start Autofix Worker
npm run dev:autofix
```

## Test Scenarios

### Test 1: Profile Settings & Email Configuration
**Goal**: Verify users can set notification email

1. Open `http://localhost:3000`
2. Login with GitHub
3. Click **Settings ▾** → **👤 Profile & Email**
4. You should see:
   - GitHub Email (read-only)
   - Notification Email (editable)
5. Enter a test email: `test@example.com`
6. Click **Save Changes**
7. Verify success message appears
8. Refresh page - email should persist

**Expected Result**: ✅ Email saved successfully

---

### Test 2: Notification Preferences
**Goal**: Verify users can manage notification settings

1. From dashboard, click **Settings ▾** → **🔔 Notifications**
2. You should see toggles for:
   - Email notifications (4 event types)
   - Toast notifications (4 event types)
3. Toggle some options ON/OFF
4. Click **Save Preferences**
5. Verify success message
6. Refresh page - settings should persist

**Expected Result**: ✅ Preferences saved successfully

---

### Test 3: Mode 2 - Dark Theme Selection Page
**Goal**: Verify dark theme and improved UI

1. Create a test PR or use existing PR analysis
2. Navigate to `/runs/{runId}/select`
3. Verify dark theme:
   - Dark background (#1a1f2e)
   - Light text on dark
   - Category badges (BLOCKING, URGENT, etc.)
   - Selection controls
4. Test functionality:
   - Select BLOCKING button
   - Select URGENT button
   - Select ALL button
   - Invert button
   - Clear All button
5. Verify live selected breakdown shows:
   - Per-category counts
   - Estimated time

**Expected Result**: ✅ Dark theme applied, all controls work

---

### Test 4: Email Notifications - Mode 0 (Auto-Merge)
**Goal**: Verify email sent on auto-merge

**Prerequisites**: 
- SMTP configured
- User has notification email set
- Installation set to Mode 0 (Auto-Merge)

**Steps**:
1. Go to `/installations`
2. Select your installation
3. Set mode to **Mode 0 (Auto-Merge)**
4. Save settings
5. Create a PR in connected repository
6. Wait for analysis to complete
7. Check your email inbox

**Expected Emails**:
1. "📝 PR #X analyzed - Y issues found"
2. "✅ Auto-merge completed for {repo} PR #X"

**Expected Result**: ✅ 2 emails received

---

### Test 5: Email Notifications - Mode 1 (Approval Required)
**Goal**: Verify email sent when approval needed

**Prerequisites**: 
- SMTP configured
- Installation set to Mode 1

**Steps**:
1. Set installation to Mode 1
2. Create a PR
3. Wait for analysis
4. Check email

**Expected Emails**:
1. "📝 PR #X analyzed"
2. "👀 Approval needed for {repo} PR #X"

**Expected Result**: ✅ 2 emails with GitHub PR link

---

### Test 6: Email Notifications - Mode 2 (Manual Selection)
**Goal**: Verify email prompts user to select issues

**Prerequisites**: 
- SMTP configured
- Installation set to Mode 2

**Steps**:
1. Set installation to Mode 2
2. Create a PR
3. Wait for analysis
4. Check email

**Expected Email**:
- "🎯 Select issues to fix for {repo} PR #X"
- Email contains link to selection page

**Expected Result**: ✅ Email with link to `/runs/{runId}/select`

---

### Test 7: Toast Notifications (In-App)
**Goal**: Verify toast appears in browser

**Steps**:
1. Open dashboard in browser
2. Keep dashboard open
3. Trigger a PR event (create PR, apply fix, etc.)
4. Toast should appear in top-right corner
5. Click the toast

**Expected Result**: 
✅ Toast appears with:
- Title
- Message
- Clickable link
- Auto-dismisses after 5 seconds

---

### Test 8: Notification API Endpoints
**Goal**: Verify API endpoints work

**Test Unread Notifications**:
```bash
curl http://localhost:3000/api/notifications/unread \
  -H "Cookie: your_session_cookie"
```

**Test All Notifications**:
```bash
curl http://localhost:3000/api/notifications \
  -H "Cookie: your_session_cookie"
```

**Test Mark as Read**:
```bash
curl -X PUT http://localhost:3000/api/notifications/{id}/read \
  -H "Cookie: your_session_cookie"
```

**Expected Result**: ✅ JSON responses with notification data

---

### Test 9: End-to-End Workflow (Mode 2)
**Goal**: Complete workflow from PR to fix

1. **Setup**:
   - Configure SMTP
   - Set notification email
   - Enable all notifications
   - Set installation to Mode 2

2. **Create PR**:
   - Create PR in connected repo
   - Wait for webhook

3. **Check Email 1**:
   - Verify "PR analyzed" email
   - Click "Select Issues to Fix" link

4. **Selection Page**:
   - Verify dark theme
   - Select issues to fix
   - Submit selection

5. **Preview**:
   - View fixes preview
   - Apply fixes

6. **Check Email 2**:
   - Verify "Fixes applied" email

7. **Check Toast**:
   - Return to dashboard
   - Verify toast notification

**Expected Result**: ✅ Complete workflow with 2 emails + toast

---

## Troubleshooting

### Email Not Sending

**Check SMTP Configuration**:
```bash
# In logs, look for:
[email] Email service initialized
[email] Email sent successfully
```

**Common Issues**:
1. Wrong SMTP credentials
2. Gmail requires App Password (not account password)
3. SMTP_PORT incorrect (587 for TLS, 465 for SSL)
4. Firewall blocking SMTP

**Test Email Service**:
```javascript
// In node console
const emailService = require('./shared/services/emailService');
emailService.send({
  to: 'your@email.com',
  subject: 'Test',
  text: 'Test email'
});
```

### Toast Not Appearing

**Check**:
1. Browser console for errors
2. Toast partial included in page
3. Notification created in database
4. User has toast notifications enabled

### Preferences Not Saving

**Check**:
1. MongoDB connection
2. User model has notification fields
3. Browser console for AJAX errors
4. Server logs for save errors

### Dark Theme Issues

**Check**:
1. Browser cache cleared
2. `select.ejs` file updated
3. No CSS conflicts
4. Correct file loaded (check view source)

---

## Success Checklist

Before marking complete, verify:

- [ ] Profile settings page accessible
- [ ] Email can be set and saved
- [ ] Notification preferences page loads
- [ ] Preferences can be toggled and saved
- [ ] Dark theme applied to selection page
- [ ] Email sent for Mode 0 (auto-merge)
- [ ] Email sent for Mode 1 (approval needed)
- [ ] Email sent for Mode 2 (manual selection)
- [ ] Toast notifications appear in browser
- [ ] Notification API endpoints return data
- [ ] All emails contain correct links
- [ ] Email settings are respected
- [ ] Selection controls work (Select ALL, Invert, etc.)
- [ ] Live selected breakdown updates

---

## Quick Verification Commands

```bash
# Check if services are running
curl http://localhost:3001/health
curl http://localhost:3000/

# Check database for notifications
mongosh peer --eval "db.notifications.countDocuments()"

# Check user notification settings
mongosh peer --eval "db.users.findOne({}, {notifications: 1, notificationEmail: 1})"

# Check recent logs
# API logs
tail -f services/api/server.log

# Worker logs
tail -f services/analyzer/worker.log
```

---

## Demo Video Script (Optional)

1. **Login**: Show GitHub OAuth login
2. **Profile**: Set notification email
3. **Preferences**: Toggle notification settings
4. **Create PR**: Trigger PR in connected repo
5. **Show Email**: Display email received
6. **Selection Page**: Show dark theme, select issues
7. **Preview**: Show fixes preview
8. **Toast**: Show toast notification
9. **Complete**: Show final result

---

All tests passing = System ready for production! 🎉
