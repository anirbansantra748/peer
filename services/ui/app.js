require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const configurePassport = require('../../shared/auth/passport');
const { categorizeAllFindings, getCategorySummary } = require('../../shared/utils/issueCategorizer');
const { requireAuth, redirectIfAuthenticated } = require('../../shared/middleware/requireAuth');
const Installation = require('../../shared/models/Installation');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB (for session store and user data)
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/peer')
  .then(() => console.log('[ui] Connected to MongoDB'))
  .catch((err) => {
    console.error('[ui] MongoDB connection error:', err);
    process.exit(1);
  });

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/peer',
      collectionName: 'sessions',
      touchAfter: 24 * 3600, // Update session once per 24 hours unless changed
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    },
  })
);

// Initialize Passport
const passport = configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Make user available in all views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// Auth routes
app.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', { title: 'Login' });
});

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get(
  '/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect to original URL or home
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('[ui] Logout error:', err);
    }
    res.redirect('/login');
  });
});

app.get('/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user.toSafeObject());
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Protected routes
app.get('/', requireAuth, (req, res) => res.render('index', { title: 'Peer Dashboard' }));
app.get('/run', requireAuth, (req, res) => res.render('run', { title: 'Run' }));

// Installation routes
app.get('/installations', requireAuth, async (req, res) => {
  try {
    // Get all active installations (optionally filter by user later)
    const installations = await Installation.find({ status: 'active' }).sort({ installedAt: -1 });
    res.render('installations', { 
      title: 'GitHub App Installations', 
      installations 
    });
  } catch (error) {
    console.error('[ui] Error fetching installations:', error);
    res.status(500).send('Failed to load installations');
  }
});

app.get('/installations/:id/settings', requireAuth, async (req, res) => {
  try {
    const installation = await Installation.findById(req.params.id);
    if (!installation) {
      return res.status(404).send('Installation not found');
    }
    res.render('settings', { 
      title: `Configure ${installation.accountLogin}`, 
      installation 
    });
  } catch (error) {
    console.error('[ui] Error fetching installation:', error);
    res.status(500).send('Failed to load installation settings');
  }
});

app.post('/installations/:id/settings', requireAuth, async (req, res) => {
  try {
    const installation = await Installation.findById(req.params.id);
    if (!installation) {
      return res.status(404).send('Installation not found');
    }

    // Update config from form data
    installation.config.mode = req.body.mode || 'analyze';
    
    // Handle severities (checkbox array)
    const severities = Array.isArray(req.body.severities) 
      ? req.body.severities 
      : (req.body.severities ? [req.body.severities] : []);
    installation.config.severities = severities.filter(s => 
      ['critical', 'high', 'medium', 'low'].includes(s)
    );
    
    // Ensure at least one severity is selected
    if (installation.config.severities.length === 0) {
      installation.config.severities = ['critical', 'high'];
    }

    installation.config.maxFilesPerRun = parseInt(req.body.maxFilesPerRun) || 10;
    installation.config.autoMerge.enabled = req.body.autoMergeEnabled === 'on';
    installation.config.autoMerge.requireTests = req.body.requireTests === 'on';
    installation.config.autoMerge.requireReviews = parseInt(req.body.requireReviews) || 0;

    await installation.save();
    
    res.redirect('/installations?success=Configuration+saved');
  } catch (error) {
    console.error('[ui] Error saving installation settings:', error);
    res.status(500).send('Failed to save settings');
  }
});

// Select page: list findings for a run
app.get('/runs/:runId/select', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    const resp = await axios.get(`${API_BASE}/runs/${runId}`);
    const run = resp.data;
    
    // Debug: Check if findings have _id
    console.log('[ui] Sample findings before categorization:', (run.findings || []).slice(0, 2).map(f => ({ _id: f._id, file: f.file, hasId: !!f._id })));
    
    // Enhance findings with categorization
    const enhancedFindings = categorizeAllFindings(run.findings || []);
    console.log('[ui] Sample findings after categorization:', enhancedFindings.slice(0, 2).map(f => ({ _id: f._id, file: f.file, hasId: !!f._id })));
    const summary = getCategorySummary(run.findings || []);
    
    // Sort by category priority then by file
    const categoryOrder = { BLOCKING: 4, URGENT: 3, RECOMMENDED: 2, OPTIONAL: 1 };
    const findings = enhancedFindings.sort((a, b) => 
      (categoryOrder[b.category] - categoryOrder[a.category]) || 
      a.file.localeCompare(b.file) || 
      (a.line - b.line)
    );
    
    res.render('select', { title: `Select fixes — Run ${runId}`, runId, run, findings, summary, query: req.query });
  } catch (e) {
    res.status(500).send(`Failed to load run: ${e?.response?.data?.error || e.message}`);
  }
});

// Create preview for selected findings
app.post('/runs/:runId/preview', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    let ids = req.body['selectedFindingIds[]'] || req.body.selectedFindingIds || [];
    if (!Array.isArray(ids)) ids = [ids];
    ids = ids.filter(Boolean);
    console.log('[ui] Selected finding IDs received from browser:', ids.length, 'IDs:', ids.slice(0, 10));
    if (ids.length === 0) {
      return res.redirect(`/runs/${runId}/select?err=${encodeURIComponent('Please select at least one finding')}`);
    }
    const resp = await axios.post(`${API_BASE}/runs/${runId}/patches/preview`, { selectedFindingIds: ids });
    const { patchRequestId, filesQueued } = resp.data;
    console.log('[ui] Preview created:', { patchRequestId, filesQueued });
    res.redirect(`/runs/${runId}/preview?patchRequestId=${encodeURIComponent(patchRequestId)}`);
  } catch (e) {
    res.status(500).send(`Failed to create preview: ${e?.response?.data?.error || e.message}`);
  }
});

// Preview page: show unified diff and status
app.get('/runs/:runId/preview', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    const { patchRequestId } = req.query;
    if (!patchRequestId) return res.status(400).send('patchRequestId is required');
    const resp = await axios.get(`${API_BASE}/runs/${runId}/patches/${patchRequestId}`);
    const patch = resp.data;
    res.render('preview', { title: `Preview — Run ${runId}`, runId, patchRequestId, patch, query: req.query });
  } catch (e) {
    res.status(500).send(`Failed to load preview: ${e?.response?.data?.error || e.message}`);
  }
});

// Proxy: list files for a patch (for on-demand processing UI)
app.get('/runs/:runId/patches/:patchRequestId/files', async (req, res) => {
  try {
    const { runId, patchRequestId } = req.params;
    const r = await axios.get(`${API_BASE}/runs/${runId}/patches/${patchRequestId}/files`);
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e?.response?.data?.error || e.message });
  }
});

// Proxy: get/process a single file for a patch
app.get('/runs/:runId/patches/:patchRequestId/file', async (req, res) => {
  try {
    const { runId, patchRequestId } = req.params;
    const params = new URLSearchParams();
    if (req.query.file) params.append('file', req.query.file);
    if (req.query.process) params.append('process', req.query.process);
    const url = `${API_BASE}/runs/${runId}/patches/${patchRequestId}/file?${params.toString()}`;
    const r = await axios.get(url);
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e?.response?.data?.error || e.message });
  }
});

// Apply preview
app.post('/runs/:runId/patches/apply', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    const { patchRequestId } = req.body;
    if (!patchRequestId) return res.status(400).send('patchRequestId is required');
    await axios.post(`${API_BASE}/runs/${runId}/patches/apply`, { patchRequestId });
    res.redirect(`/runs/${runId}/patches/${encodeURIComponent(patchRequestId)}`);
  } catch (e) {
    res.status(500).send(`Failed to apply patch: ${e?.response?.data?.error || e.message}`);
  }
});

// Patch status/results page
app.get('/runs/:runId/patches/:patchRequestId', requireAuth, async (req, res) => {
  try {
    const { runId, patchRequestId } = req.params;
    const resp = await axios.get(`${API_BASE}/runs/${runId}/patches/${patchRequestId}`);
    const patch = resp.data;
    res.render('patch', { title: `Patch — Run ${runId}`, runId, patchRequestId, patch });
  } catch (e) {
    res.status(500).send(`Failed to fetch patch status: ${e?.response?.data?.error || e.message}`);
  }
});

const PORT = process.env.UI_PORT || 3000;
app.listen(PORT, () => console.log(`[ui] listening on ${PORT}`));
