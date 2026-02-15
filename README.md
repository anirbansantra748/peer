# 🤖 Peer - AI-Powered Code Review Platform

> **Your 24/7 AI Pair Programmer.** Automated Pull Request analysis, intelligent auto-fixes, and security auditing—integrated directly into your GitHub workflow.

[![Live Demo](https://img.shields.io/badge/demo-live-green)](https://peer-ui.onrender.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🌟 Why Peer?

Peer isn't just a linter; it's an intelligent code review agent that understands context. While other tools just find bugs, **Peer fixes them.**

| Feature | Standard Linters | Peer AI |
| :--- | :---: | :---: |
| **Context Awareness** | ❌ Line-by-line only | ✅ Full file & cross-file context |
| **Auto-Fixing** | ⚠️ Basic formatting only | ✅ Complex logic & security fixes |
| ** Workflow** | ❌ Manual review required | ✅ Auto-commit & Auto-merge options |
| **Security** | ⚠️ Static rules only | ✅ AI-driven vulnerability detection |

---

## 🚀 Key Features

### 1. Intelligent Analysis Engine
Peer listens to your Pull Requests events in real-time. As soon as a PR is opened or updated, Peer:
- **Clones & Analyzes**: Scans code using industry-standard tools (ESLint, Semgrep, Bandit, etc.).
- **Categorizes Findings**: Groups issues by severity (Critical, High, Medium, Low).
- **AI Verification**: Uses LLMs (GPT-4, Gemini, Groq) to verify findings and reduce false positives.

### 2. Recursive Auto-Fixing
Don't just see the error—fix it.
- **Auto-Generated Commits**: Peer can push fixes directly to your PR branch.
- **Smart Context**: Understands relevant code dependencies to prevent breaking changes.
- **Human-in-the-Loop**: Choose to review fixes first or let Peer handle routine cleanups automatically.

### 3. Comprehensive Audit Logs
Track every action Peer takes.
- **Detailed History**: View every PR analyzed, every issue found, and every token consumed.
- **Trend Analysis**: Visualize your "Fix Rate" and "Success Rate" over time.
- **Repo Insights**: See which repositories have the most quality issues.

---

## ⚙️ Configuration & Settings

Peer puts you in complete control. Customize the behavior for each installation via the **Settings** dashboard.

### 🧠 Processing Modes
Choose how autonomous you want Peer to be:

- **🛡️ User Selection (Review Mode)** `SAFE`
    - Peer analyzes code and reports findings in the UI.
    - **You** select specific issues to fix.
    - *Best for: New users, critical production repos.*

- **⚡ Auto-Commit** `REQUIRES APPROVAL`
    - Peer automatically generates fixes and commits them to the PR.
    - It does **not** merge the PR.
    - *Best for: Speeding up development cycles.*

- **🔥 Full Auto-Merge** `DANGEROUS`
    - Peer fixes issues and **automatically merges** the PR if tests pass.
    - *Best for: Dependabot PRs, minor style fixes, or high-trust test environments.*

### 🎚️ Severity Filters
Decide what matters to you. Filter noise by selecting which issues to act on:
- **🔴 Critical**: Security vulnerabilities, potential data loss.
- **🟡 High**: Major bugs, performance bottlenecks.
- **🔵 Medium**: Code quality, maintainability issues.
- **⚪ Low**: Style guide violations, minor suggestions.

### 🤖 Auto-Merge Safeguards
Even in automation, safety comes first.
- **Require Tests**: Auto-merge will *only* trigger if your CI/CD tests pass.
- **Required Approvals**: Set a minimum number of human reviews before Peer can merge (e.g., "Require 1 human approval").

---

## 🔔 Notifications

Stay in the loop without the noise. Configure your preferences at `/notification-preferences`.

- **📧 Email Notifications**: Get summaries of completed runs.
- **💬 PR Comments**: Let Peer comment directly on your PRs with insights.
- **🛠️ Auto-Fix Updates**: Get notified when Peer pushes a fix commit.
- **📅 Weekly Digest**: A summary of your team's code quality trends delivered every Monday.

---

## 📦 Installation & Getting Started

### 1. Sign In
Visit the [Peer Dashboard](https://peer-ui.onrender.com) and sign in with your GitHub account. We use secure OAuth—we never see your password.

### 2. Install the GitHub App
Click **"Add More Repositories"** in the sidebar. You'll be redirected to GitHub to select which repositories Peer can access.
- *Select "All Repositories" for effortless onboarding.*
- *Select specific repositories for granular control.*

### 3. Configure Your Repo
Once installed, click **"Configure"** on any installation in the dashboard to set your Processing Mode and Severity Filters.

### 4. Open a Pull Request!
That's it! Open a PR in any connected repository. Peer will automatically pick it up, analyze it, and report back in seconds.

---

## 🛡️ Security & Privacy

We treat your code with the highest level of security.
- **Ephemeral Clones**: We clone your code for analysis and delete it immediately after.
- **Encrypted Keys**: All API keys and tokens are encrypted at rest using AES-256.
- ** Least Privilege**: Our GitHub App requests only the permissions strictly necessary for analysis.

---

## 🛠️ Tech Stack & Architecture

Built for scale and performance.
- **Frontend**: Express.js + EJS (Server-side rendering)
- **Backend**: Microservices (API, Analyzer, Autofix, DepScan)
- **Queue**: Redis + BullMQ for asynchronous job processing
- **Database**: MongoDB for persistent findings and user data
- **Hosting**: Render.com (Dockerized services)

---

## 👨‍💻 Developer

**Anirban Santra**
- GitHub: [@anirbansantra748](https://github.com/anirbansantra748)
- Email: anirbansantra747@gmail.com

---

**[Peer](https://peer-ui.onrender.com) — Code cleaner, ship faster.**
