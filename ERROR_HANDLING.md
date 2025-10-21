# Error Handling Implementation

This document describes the comprehensive error handling system implemented in the Peer application.

## Overview

The application now features production-grade error handling that:
- ✅ Prevents application crashes
- ✅ Logs all errors for debugging
- ✅ Notifies users via toast notifications
- ✅ Handles token limit errors with actionable links
- ✅ Provides detailed error pages in development
- ✅ Catches all unhandled promises and exceptions

## Components

### 1. Error Notification System
**Location:** `shared/utils/errorNotification.js`

Provides utility functions to create user-facing notifications for errors:

```javascript
const { notifyUserError, notifyTokenLimitExceeded, notifyApiError } = require('./shared/utils/errorNotification');

// General error notification
await notifyUserError({
  userId: user._id,
  type: 'api_error',
  title: 'Operation Failed',
  message: 'Failed to process your request',
  link: '/some-page',
  sendEmail: false
});

// Token limit notification
await notifyTokenLimitExceeded(userId, tokensUsed, tokenLimit);

// GitHub error notification
await notifyGitHubError(userId, repo, errorMessage);
```

### 2. Global Error Handler
**Location:** `shared/middleware/errorHandler.js`

Provides middleware for catching and handling errors:

- `asyncHandler(fn)` - Wraps async route handlers to catch errors
- `globalErrorHandler` - Catches all errors and sends appropriate responses
- `notFoundHandler` - Handles 404 errors
- `handleSpecificErrors` - Handles database, JWT, and API errors
- `AppError` - Custom error class for operational errors

### 3. Notification Types

The following notification types are supported:

| Type | Toast Color | Use Case |
|------|-------------|----------|
| `token_limit_exceeded` | Warning (Yellow) | When user hits token limits |
| `api_error` | Error (Red) | General API failures |
| `github_error` | Error (Red) | GitHub API failures |
| `installation_error` | Error (Red) | Installation/setup issues |
| `error` | Error (Red) | Generic errors |
| `fix_failed` | Error (Red) | Autofix failures |
| `fix_complete` | Success (Green) | Autofix successes |
| `pr_created` | Info (Blue) | PR created notifications |
| `approval_needed` | Warning (Yellow) | Manual approval needed |

### 4. Token Limit Handling

When users exceed their token limits, they receive:

1. **Toast Notification** with:
   - Clear message about the limit
   - Link to API keys settings page
   - Instructions to add own keys or upgrade

2. **Email Notification** (if enabled)

3. **Error in the UI** with actionable next steps

**Implementation Example:**
```javascript
// In autofix/engine.js
if (!check.allowed && !check.useUserKeys) {
  // Notify user
  await notifyTokenLimitExceeded(
    userContext._id,
    userContext.tokensUsed,
    userContext.tokenLimit
  );
  throw new Error(check.reason);
}
```

### 5. Error Page

**Location:** `services/ui/views/error.ejs`

A user-friendly error page that:
- Shows appropriate emoji (🔍 for 404, ⚠️ for errors)
- Displays user-friendly error message
- Shows stack trace in development mode
- Provides "Go to Dashboard" and "Go Back" buttons

## Usage

### In Routes

All routes are protected by the global error handler. For additional error handling:

```javascript
app.get('/my-route', requireAuth, async (req, res) => {
  try {
    // Your route logic
    const data = await someOperation();
    res.json(data);
  } catch (error) {
    // Error will be caught by global handler
    // Optionally notify user:
    await notifyApiError(req.user._id, 'My Operation', error.message);
    throw error; // Let global handler format response
  }
});
```

### Custom Operational Errors

For expected errors that should be handled gracefully:

```javascript
const { AppError } = require('../../shared/middleware/errorHandler');

if (!validInput) {
  throw new AppError('Invalid input provided', 400);
}
```

### Async Route Handlers

Use `asyncHandler` for cleaner code (optional, global handler catches all):

```javascript
const { asyncHandler } = require('../../shared/middleware/errorHandler');

app.get('/my-route', requireAuth, asyncHandler(async (req, res) => {
  const data = await someOperation();
  res.json(data);
}));
```

## Error Flow

1. **Error Occurs** in application code
2. **Try-Catch** in route handler (optional)
3. **Global Error Handler** catches error
4. **Specific Error Handler** processes known error types
5. **User Notification** created (if user authenticated)
6. **Response Sent** (JSON for API, HTML for web)
7. **Error Logged** to console/log system

## Testing

To test error handling:

```javascript
// Trigger an error in development
app.get('/test-error', (req, res) => {
  throw new Error('Test error');
});

// Test token limit
app.get('/test-token-limit', requireAuth, async (req, res) => {
  await notifyTokenLimitExceeded(req.user._id, 1500, 1000);
  res.json({ ok: true });
});

// Test async error
app.get('/test-async-error', async (req, res) => {
  await Promise.reject(new Error('Async error'));
});
```

## Process-Level Error Handling

Both UI and API servers handle:

### Unhandled Promise Rejections
```javascript
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason });
});
```

### Uncaught Exceptions
```javascript
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  // Gracefully exit after logging
  setTimeout(() => process.exit(1), 1000);
});
```

## Best Practices

1. **Always await promises** to ensure errors are caught
2. **Use try-catch** for critical operations
3. **Notify users** for recoverable errors
4. **Log everything** for debugging
5. **Provide context** in error messages
6. **Link to solutions** (e.g., API keys page for token limits)
7. **Test error paths** regularly
8. **Use AppError** for expected errors with specific status codes

## Configuration

### Environment Variables

- `NODE_ENV=development` - Shows stack traces in error page
- `LOG_LEVEL=debug` - Increases log verbosity

### Notification Settings

Users can control notifications in:
- `/notification-preferences` - Email preferences
- Toast notifications are always shown

## Monitoring

All errors are logged with:
- Error message and stack trace
- Request URL and method
- User ID (if authenticated)
- Timestamp
- Additional context

Use your log aggregation service to monitor:
- Error frequency
- Error types
- User impact
- Token limit errors

## Future Enhancements

- [ ] Sentry/error tracking integration
- [ ] Error rate limiting to prevent spam
- [ ] User-specific error history page
- [ ] Retry mechanisms for transient errors
- [ ] Circuit breaker for external APIs
