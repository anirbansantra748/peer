# 🛠️ GitHub App Setup Guide (New Account)

Since your old account is suspended, we are creating a **Fresh Start**. Follow these steps exactly to create the "Peer V2" App on your new GitHub account.

---

## 1. Create the App

1.  Log in to your **New GitHub Account**.
2.  Go to: **Settings** > **Developer settings** > **GitHub Apps**.
3.  Click **New GitHub App**.
4.  **GitHub App Name**: `Peer Code Review (V2)` (or something unique like `Peer - <YourName>`).
5.  **Homepage URL**: `http://localhost:3000` (We will change this later for Live).

---

## 2. Webhook Configuration

This is how GitHub talks to your code.

### For Local Development (Right Now)
1.  **Active**: Check "Active".
2.  **Webhook URL**: You need your Ngrok URL.
    *   Open terminal: `ngrok http 3001` (Assuming API runs on 3001).
    *   Copy the `https://....ngrok-free.app` URL.
    *   Paste it here and add `/api/webhook` at the end.
    *   *Example*: `https://a1b2-c3d4.ngrok-free.app/api/webhook`
3.  **Webhook Secret**:
    *   Create a text file/password. Example: `peer_local_dev_secret_2026`
    *   Paste it in "Webhook secret".
    *   **Save this secret** in your `.env` as `GITHUB_WEBHOOK_SECRET`.

---

## 3. Permissions (The Critical Part)

Click **Permissions & events** (or scroll down).

| Permission | Access | Reason |
| :--- | :--- | :--- |
| **Repository permissions** | | |
| `Contents` | **Read-only** | To read the code for review. |
| `Metadata` | **Read-only** | Mandatory. |
| `Pull Requests` | **Read & Write** | To post comments and reviews. |
| `Commit statuses` | **Read & Write** | To set "Pending/Success" checks on PRs. |
| `Checks` | **Read & Write** | To add detailed check runs. |
| **Subscribe to events** | | |
| `Pull request` | **Check** | To trigger reviews on new PRs. |
| `Push` | **Check** | To sync code (for future vector indexing). |

---

## 4. Generate Credentials

Scroll to the bottom and click **Create GitHub App**.
Once created, you will see the "General" page.

1.  **App ID**: visible at top (e.g., `2715738`). **Copy this**.
2.  **Client ID**: visible at top (e.g., `Iv23liow9PcosJGFX3vn`). **Copy this**.
3.  **Client Secret**:
    *   Click "Generate a new client secret".
    *   **Copy it immediately** (you won't see it again).
4.  **Private Key**:
    *   Scroll down to "Private keys".
    *   Click "Generate a private key".
    *   A `.pem` file will download to your computer.

---

## 5. Optional Features (Important)

In the **"Identifying and authorizing users"** section:

1.  **Expire user authorization tokens**: **UNCHECK** (Leave empty).
    *   *Reason*: Keeps it simple for now. If checked, we have to handle "Refresh Tokens" every 8 hours.
2.  **Request user authorization (OAuth) during installation**: **CHECK** (Enable).
    *   *Reason*: When someone installs the app, it automatically logs them in/creates an account.
3.  **Enable Device Flow**: **UNCHECK** (Leave empty).
    *   *Reason*: We are a web app, not a CLI tool.

---

## 6. Update Your Project (`.env`)

Open your `peer` project. Open `.env`. Replace the OLD keys with these NEW ones.

```ini
# New GitHub App Credentials
GITHUB_APP_ID=2715738
GITHUB_CLIENT_ID=Iv23liow9PcosJGFX3vn
GITHUB_CLIENT_SECRET=Paste_That_Secret_Here
GITHUB_WEBHOOK_SECRET=peer_local_dev_secret_2026

# Private Key - OPEN the .pem file with Notepad, COPY EVERYTHING
# And paste it carefully inside quotes, preserving newlines if possible
# OR refer to the file path (depending on how your code reads it)
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
...
-----END RSA PRIVATE KEY-----"
```

---

## 6. How to Switch to LIVE (Render) Later

When you are ready to go live:
1.  Go back to **GitHub App Settings** > **General**.
2.  **Homepage URL**: Change to `https://your-app-name.onrender.com`.
3.  **Webhook URL**: Change to `https://your-app-name.onrender.com/api/webhook`.
4.  **Callback URL**: Change to `https://your-app-name.onrender.com/auth/github/callback`.
5.  Click **Save Changes**.

Done! Your live app will now receive the traffic.
