# 🤖 Peer - AI-Powered Code Review Platform

> Automated Pull Request analysis and auto-fixing using AI/LLM with GitHub App integration

[![Live Demo](https://img.shields.io/badge/demo-live-green)](https://peer-ui.onrender.com)
[![API Status](https://img.shields.io/badge/API-operational-success)](https://peer-apii.onrender.com/health)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Overview

**Peer** is an enterprise-grade automated code review platform that integrates with GitHub via webhooks to analyze pull requests in real-time. It combines static analysis, security scanning, and AI-powered suggestions to provide comprehensive code quality insights and automated fixes.

### Key Features

- ⚡ **Real-time PR Analysis** - Instant webhook-triggered code reviews
- 🔍 **Multi-Analyzer Engine** - ESLint, Semgrep, Bandit, PMD, Checkov, npm audit, and more
- 🤖 **AI Auto-Fix** - LLM-powered automatic code fixes with intelligent reasoning
- 🔐 **GitHub App Integration** - Secure OAuth and installation management
- 📊 **Dashboard & Analytics** - Track code quality metrics across repositories
- 🔄 **Auto-Merge** - Configurable automatic PR merging with approval workflows
- 💳 **Subscription Management** - Integrated Razorpay payment system
- 🚀 **Microservices Architecture** - Scalable, distributed system design

---

## 🏗️ Architecture

### System Design

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   GitHub    │─────▶│  API Server  │─────▶│   Redis     │
│  Webhooks   │      │   (Express)  │      │  (Queue)    │
└─────────────┘      └──────────────┘      └─────────────┘
                             │                     │
                             ▼                     ▼
                     ┌──────────────┐      ┌─────────────┐
                     │   MongoDB    │      │  Workers    │
                     │  (Database)  │      │  (BullMQ)   │
                     └──────────────┘      └─────────────┘
                                                   │
                           ┌───────────────────────┼───────────────────────┐
                           ▼                       ▼                       ▼
                    ┌────────────┐         ┌────────────┐         ┌────────────┐
                    │  Analyzer  │         │  Autofix   │         │  DepScan   │
                    │   Worker   │         │   Worker   │         │   Worker   │
                    └────────────┘         └────────────┘         └────────────┘
```

### Microservices

| Service | Purpose | Technology |
|---------|---------|------------|
| **API** | Webhook handling, authentication, REST API | Express.js, Passport.js |
| **Analyzer** | Static analysis, code quality checks | ESLint, Semgrep, PMD, Bandit |
| **Autofix** | AI-powered code fixing | OpenAI, Groq, Gemini APIs |
| **DepScan** | Dependency & IaC vulnerability scanning | npm audit, pip-audit, Checkov |
| **UI** | Dashboard, PR views, analytics | EJS, Express, Chart.js |

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 22.x
- **Framework:** Express.js 5.x
- **Database:** MongoDB (Mongoose ODM)
- **Queue:** Redis + BullMQ
- **Authentication:** Passport.js + GitHub OAuth
- **GitHub Integration:** @octokit/rest, @octokit/auth-app

### AI/LLM Integration
- **OpenAI GPT-4**
- **Groq (Mixtral, Llama)**
- **Google Gemini**
- Intelligent fallback system with token tracking

### DevOps & Infrastructure
- **Hosting:** Render.com (4 independent services)
- **CI/CD:** GitHub Actions
- **Containerization:** Docker
- **Monitoring:** Health checks, uptime monitoring

### Static Analysis Tools
- ESLint (JavaScript/TypeScript)
- Semgrep (Multi-language security)
- Bandit (Python security)
- PMD (Java code quality)
- Checkov (IaC security)
- Hadolint (Dockerfile linting)

---

## 🚀 Features Deep Dive

### 1. Intelligent Code Analysis

**Multi-layer analysis pipeline:**
```
PR Event → Clone Repo → Language Detection → Parallel Analyzers → Findings Aggregation
```

- **Static Analysis:** Detects style violations, logic errors, security issues
- **Complexity Analysis:** Cyclomatic complexity, maintainability index
- **Security Scanning:** SQL injection, XSS, hardcoded secrets detection
- **Best Practices:** Framework-specific recommendations

**Supported Languages:**
- JavaScript/TypeScript (ESLint, Semgrep)
- Python (Bandit, Pylint, Semgrep)
- Java (PMD, Semgrep)
- Dockerfile (Hadolint)
- YAML/JSON (Checkov, schema validation)

### 2. AI-Powered Auto-Fix

**Workflow:**
```
Findings → AI Context Building → LLM Reasoning → Code Generation → Syntax Validation → Git Operations
```

**Features:**
- Full-file AI rewrites or minimal patches
- Multi-file fix coordination
- Checksum verification to prevent conflicts
- Automatic branch creation and PR submission
- Configurable auto-merge with approval workflows

**LLM Strategy:**
- `minimal`: Line-by-line patches for targeted fixes
- `full`: Complete file rewrites with context understanding
- Token budget management per user
- Response caching for performance

### 3. GitHub App Integration

**Capabilities:**
- Real-time webhook event processing (PR opened, synchronized, closed)
- Installation token management for secure API calls
- Automated PR comments with analysis summaries
- Status checks integration
- Repository configuration per installation

**Modes:**
- `comment-only`: Post findings as PR comments
- `commit`: Create fix branches and PRs
- `merge`: Auto-merge fixes after validation

### 4. User Management & Subscriptions

**Tiers:**
- **Free:** 1,000 tokens/month, basic analysis
- **Pro:** 10,000 tokens/month, priority processing
- **Enterprise:** Unlimited tokens, dedicated support

**Features:**
- GitHub OAuth authentication
- Razorpay payment integration
- Token usage tracking
- Custom API key support (BYOK)
- Email notifications

---

## 📦 Installation & Setup

### Prerequisites
```bash
Node.js >= 18.x
MongoDB >= 5.x
Redis >= 6.x
Docker (optional, for local dev)
```

### Local Development

1. **Clone repository:**
```bash
git clone https://github.com/anirbansantra748/peer.git
cd peer
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Start infrastructure (Docker):**
```bash
npm run dev:infra
```

5. **Run services:**
```bash
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Analyzer
npm run dev:analyzer

# Terminal 3 - Autofix
npm run dev:autofix

# Terminal 4 - UI
npm run dev:ui
```

### Environment Variables

```env
# Database
MONGO_URI=mongodb://localhost:27017/peer
REDIS_URL=redis://localhost:6379

# GitHub App
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# LLM APIs (at least one required)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...

# Security
SESSION_SECRET=your_random_secret
ENCRYPTION_KEY=32_char_random_string

# Payment (optional)
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...

# Deployment
NODE_ENV=production
API_BASE=https://your-api.onrender.com
UI_BASE=https://your-ui.onrender.com
```

---

## 🔧 API Endpoints

### Public Endpoints
```
GET  /health                    - Health check
POST /webhook/github-app        - GitHub App webhook receiver
GET  /auth/github               - GitHub OAuth login
GET  /auth/github/callback      - OAuth callback
```

### Authenticated Endpoints
```
GET  /api/dashboard             - User dashboard data
GET  /api/runs                  - List PR analysis runs
GET  /api/runs/:id              - Get specific run details
POST /api/patch-requests        - Create manual fix request
GET  /api/installations         - List GitHub installations
POST /api/payment/create-order  - Create payment order
```

---

## 📊 Performance & Scalability

### Optimizations
- **Caching:** Redis-based LLM response caching (24h TTL)
- **Queue:** BullMQ with priority scheduling and concurrency control
- **Database:** MongoDB indexes on frequently queried fields
- **Parallel Processing:** Concurrent analyzer execution
- **Token Budget:** Configurable time/token limits per analysis

### Metrics
- Average analysis time: **15-45 seconds** (depends on PR size)
- Auto-fix generation: **5-20 seconds** per file
- Webhook response time: **< 500ms**
- Concurrent job processing: **Up to 5 workers** per service

### Scalability
- Horizontal scaling via multiple worker instances
- Stateless API design for load balancing
- Distributed queue with Redis
- MongoDB replica sets support

---

## 🔐 Security

- ✅ GitHub webhook signature verification
- ✅ Encrypted API keys in database (AES-256)
- ✅ GitHub App installation tokens (auto-expiring)
- ✅ Rate limiting on API endpoints
- ✅ Session-based authentication with secure cookies
- ✅ Input validation and sanitization
- ✅ No secrets in logs or error messages

---

## 📈 Monitoring & Logging

### Health Checks
All services expose `/health` endpoints for uptime monitoring.

### Logging
- Structured logging with `prettyLogger`
- Request ID tracking across microservices
- Error tracking with stack traces
- Performance metrics (job duration, queue depth)

### Alerts
- Email notifications for:
  - Analysis completion
  - Fix approval required
  - Token limit exceeded
  - Payment failures

---

## 🧪 Testing

```bash
# Run tests
npm test

# Lint code
npm run lint

# Test webhook locally
curl -X POST http://localhost:3001/webhook/github-app \
  -H "Content-Type: application/json" \
  -d @test-webhook-payload.json
```

---

## 📝 Workflow Example

1. **Developer opens PR** on GitHub
2. **GitHub webhook** triggers Peer API
3. **Analyzer worker** clones repo and runs analysis
4. **Findings** saved to MongoDB, categorized by severity
5. **Autofix worker** generates AI-powered fixes
6. **New PR** created with fixes (if mode=commit/merge)
7. **Notification** sent to user via email
8. **Dashboard** updated with metrics and stats

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 👨‍💻 Author

**Anirban Santra**
- GitHub: [@anirbansantra748](https://github.com/anirbansantra748)
- Email: anirbansantra747@gmail.com

---

## 🔗 Links

- **Live Demo:** [https://peer-ui.onrender.com](https://peer-ui.onrender.com)
- **API:** [https://peer-apii.onrender.com](https://peer-apii.onrender.com)
- **Documentation:** [/docs](./docs)

---

## 🙏 Acknowledgments

- OpenAI, Groq, Google for LLM APIs
- GitHub for robust API and App platform
- Open source analyzer tools (ESLint, Semgrep, etc.)

---

**⭐ If you find this project useful, please star it on GitHub!**
