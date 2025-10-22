# Fix GitHub OAuth Redirect Issue

## Problem
After clicking "Login with GitHub", it redirects to `localhost` instead of Render URL.

## Solution

### 1. Update Render Environment Variables

#### peer-ui service (https://peer-uii.onrender.com)
```
BASE_URL=https://peer-uii.onrender.com
API_URL=https://peer-apii.onrender.com
```

#### peer-api service (https://peer-apii.onrender.com)
```
API_URL=https://peer-apii.onrender.com
UI_URL=https://peer-uii.onrender.com
```

#### peer-analyzer service
```
API_URL=https://peer-apii.onrender.com
```

#### peer-autofix service
```
API_URL=https://peer-apii.onrender.com
```

### 2. Update GitHub App Settings

Go to: https://github.com/settings/apps/peer-review-dev

Update these fields:
- **Homepage URL**: `https://peer-uii.onrender.com`
- **Callback URL**: `https://peer-uii.onrender.com/auth/github/callback`
- **Webhook URL**: `https://peer-apii.onrender.com/api/webhook`

### 3. Save and Restart

1. Save changes in GitHub App settings
2. In Render dashboard, go to each service and add/update the environment variables
3. Click "Manual Deploy" → "Deploy latest commit" for each service to restart with new env vars

### 4. Test

1. Visit https://peer-uii.onrender.com
2. Click "Login with GitHub"
3. Should redirect to GitHub OAuth, then back to your Render app
