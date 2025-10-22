require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const ejsMate = require('ejs-mate');
const configurePassport = require('../../shared/auth/passport');
const { categorizeAllFindings, getCategorySummary } = require('../../shared/utils/issueCategorizer');
const { requireAuth, redirectIfAuthenticated } = require('../../shared/middleware/requireAuth');
const Installation = require('../../shared/models/Installation');
const logger = require('../../shared/utils/prettyLogger');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

const app = express();
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static files (favicon, etc.)
app.use(express.static(path.join(__dirname, 'public')));

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
      sameSite: 'lax', // Allow cross-site requests for login flow
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

// Onboarding routes
app.get('/onboarding', requireAuth, (req, res) => {
  res.render('onboarding', { title: 'Welcome to Peer' });
});

app.get('/api/onboarding/status', requireAuth, async (req, res) => {
  try {
    const Installation = require('../../shared/models/Installation');
    const installations = await Installation.find({ userId: req.user._id });
    res.json({ hasInstallation: installations.length > 0 });
  } catch (error) {
    res.json({ hasInstallation: false });
  }
});

app.post('/api/onboarding/complete', requireAuth, async (req, res) => {
  try {
    const User = require('../../shared/models/User');
    const Installation = require('../../shared/models/Installation');
    const { mode } = req.body;
    
    // Mark onboarding complete
    await User.findByIdAndUpdate(req.user._id, { onboardingComplete: true });
    
    // Update installation mode if provided
    if (mode) {
      await Installation.updateMany(
        { userId: req.user._id },
        { $set: { 'config.mode': mode } }
      );
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error('[ui] Onboarding complete error:', error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// Protected routes
app.get('/', requireAuth, async (req, res) => {
  // Check if user needs onboarding
  if (!req.user.onboardingComplete) {
    return res.redirect('/onboarding');
  }
  
  try {
    const PRRun = require('../../shared/models/PRRun');
    const Installation = require('../../shared/models/Installation');
    
    // Get ONLY this user's installations
    const userInstallations = await Installation.find({ 
      userId: req.user._id,
      status: 'active' 
    }).lean();
    
    const installationIds = userInstallations.map(i => i._id);
    
    // Filter for this user's data only
    const userFilter = { installationId: { $in: installationIds } };
    
    // Get recent activity (last 10 runs) for user's installations
    const recentRuns = await PRRun.find(userFilter)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Runs already have the mode stored at creation time
    // Use run.mode (persisted) instead of current installation config
    recentRuns.forEach(run => {
      // Use the persisted mode from the run, fallback to 'analyze' if not set
      run.installationMode = run.mode || 'analyze';
    });
    
    // Get stats for user's installations only
    const totalRuns = await PRRun.countDocuments(userFilter);
    const completedRuns = await PRRun.countDocuments({ ...userFilter, status: 'completed' });
    // Count total repositories across all user installations
    const totalConnectedRepos = userInstallations.reduce((sum, inst) => {
      return sum + (inst.repositories ? inst.repositories.length : 0);
    }, 0);
    
    // Calculate total issues found and fixed for user's data
    const statsAgg = await PRRun.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: null,
          totalIssues: { $sum: { $size: '$findings' } },
          fixedIssues: {
            $sum: {
              $size: {
                $filter: {
                  input: '$findings',
                  cond: { $eq: ['$$this.fixed', true] }
                }
              }
            }
          }
        }
      }
    ]);
    
    const stats = statsAgg.length > 0 ? statsAgg[0] : { totalIssues: 0, fixedIssues: 0 };
    
    // Debug logging
    console.log('[ui] Dashboard stats:', {
      totalRuns,
      completedRuns,
      totalInstallations: userInstallations.length,
      totalConnectedRepos,
      totalIssues: stats.totalIssues,
      fixedIssues: stats.fixedIssues,
      recentRunsCount: recentRuns.length,
      sampleRun: recentRuns[0] ? {
        repo: recentRuns[0].repo,
        findingsCount: (recentRuns[0].findings || []).length,
        status: recentRuns[0].status
      } : null
    });
    
    // Aggregate stats by repository for user's data
    const repoStatsAgg = await PRRun.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: '$repo',
          totalPRs: { $sum: 1 },
          completedPRs: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalIssues: { $sum: { $size: '$findings' } },
          fixedIssues: {
            $sum: {
              $size: {
                $filter: {
                  input: '$findings',
                  cond: { $eq: ['$$this.fixed', true] }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          repo: '$_id',
          totalPRs: 1,
          completedPRs: 1,
          totalIssues: 1,
          fixedIssues: 1,
          successRate: {
            $cond: [
              { $gt: ['$totalPRs', 0] },
              { $multiply: [{ $divide: ['$completedPRs', '$totalPRs'] }, 100] },
              0
            ]
          },
          fixRate: {
            $cond: [
              { $gt: ['$totalIssues', 0] },
              { $multiply: [{ $divide: ['$fixedIssues', '$totalIssues'] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { totalPRs: -1 } }
    ]);
    
    const repoStats = repoStatsAgg.map(r => ({
      repo: r.repo || r._id,
      totalPRs: r.totalPRs,
      completedPRs: r.completedPRs,
      totalIssues: r.totalIssues,
      fixedIssues: r.fixedIssues,
      successRate: Math.round(r.successRate),
      fixRate: Math.round(r.fixRate)
    }));
    
    res.render('dashboard', { 
      title: 'Dashboard | Peer',
      recentRuns,
      repoStats,
      stats: {
        totalRuns,
        completedRuns,
        totalConnectedRepos,
        totalIssues: stats.totalIssues,
        fixedIssues: stats.fixedIssues
      },
      installations: userInstallations // Add installations data
    });
  } catch (error) {
    console.error('[ui] Dashboard error:', error);
    res.render('dashboard', { 
      title: 'Dashboard | Peer',
      recentRuns: [],
      repoStats: [],
      stats: { totalRuns: 0, completedRuns: 0, totalConnectedRepos: 0, totalIssues: 0, fixedIssues: 0 }
    });
  }
});
app.get('/run', requireAuth, (req, res) => res.render('run', { title: 'Run' }));

// LLM usage API proxy
app.get('/api/llm/usage', async (req, res) => {
  try {
    const response = await axios.get(`${API_BASE}/api/llm/usage`);
    res.json(response.data);
  } catch (error) {
    console.error('[ui] LLM usage fetch error:', error);
    res.json({ ok: false, total: { calls: 0, tokens: 0 }, providers: {}, daily: [] });
  }
});

// Repository overview page
app.get('/repos', requireAuth, async (req, res) => {
  try {
    const PRRun = require('../../shared/models/PRRun');
    const Installation = require('../../shared/models/Installation');
    
    // Get ONLY this user's installations
    const userInstallations = await Installation.find({ 
      userId: req.user._id,
      status: 'active' 
    }).lean();
    
    const installationIds = userInstallations.map(i => i._id);
    const userFilter = { installationId: { $in: installationIds } };
    
    // Get runs grouped by repo for user's installations only
    const repoData = await PRRun.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: '$repo',
          totalPRs: { $sum: 1 },
          totalIssues: { $sum: { $size: '$findings' } },
          issuesSolved: {
            $sum: {
              $size: {
                $filter: {
                  input: '$findings',
                  cond: { $eq: ['$$this.fixed', true] }
                }
              }
            }
          },
          completedPRs: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          lastActivity: { $max: '$updatedAt' },
          installationId: { $first: '$installationId' }
        }
      },
      { $sort: { totalPRs: -1 } }
    ]);
    
    // Get installation data for modes
    const installations = await Installation.find({}).lean();
    const installationMap = {};
    installations.forEach(inst => {
      installationMap[String(inst._id)] = inst;
    });
    
    const repos = repoData.map(r => {
      const installation = installationMap[String(r.installationId)];
      const modeNames = { commit: 'Auto Merge', merge: 'Auto Merge', review: 'Manual' };
      const mode = installation ? installation.config.mode : 'review';
      const modeNum = mode === 'commit' || mode === 'merge' ? 0 : 2;
      
      return {
        name: r._id,
        totalPRs: r.totalPRs,
        totalIssues: r.totalIssues,
        issuesSolved: r.issuesSolved,
        fixRate: r.totalIssues > 0 ? Math.round((r.issuesSolved / r.totalIssues) * 100) : 0,
        successRate: r.totalPRs > 0 ? Math.round((r.completedPRs / r.totalPRs) * 100) : 0,
        lastActivity: r.lastActivity,
        mode: modeNum,
        modeName: modeNames[mode] || 'Manual'
      };
    });
    
    const totalRepos = repos.length;
    const totalPRs = repos.reduce((sum, r) => sum + r.totalPRs, 0);
    const totalIssues = repos.reduce((sum, r) => sum + r.totalIssues, 0);
    const totalFixed = repos.reduce((sum, r) => sum + r.issuesSolved, 0);
    
    res.render('repo-overview', {
      title: 'Repository Overview',
      repos,
      totalRepos,
      totalPRs,
      totalIssues,
      totalFixed
    });
  } catch (error) {
    console.error('[ui] Repository overview error:', error);
    res.status(500).send('Failed to load repository overview');
  }
});

// Repository details page (handles org/repo path)
app.get('/repo/:owner/:repoName', requireAuth, async (req, res) => {
  try {
    const PRRun = require('../../shared/models/PRRun');
    // Construct full repo name from owner and repo
    const repoName = `${req.params.owner}/${req.params.repoName}`;
    
    const runs = await PRRun.find({ repo: repoName }).lean();
    
    if (runs.length === 0) {
      return res.status(404).send('Repository not found');
    }
    
    // Collect all issues across all PRs
    const allIssues = [];
    const filesSet = new Set();
    
    runs.forEach(run => {
      (run.findings || []).forEach(finding => {
        allIssues.push({
          ...finding,
          prNumber: run.prNumber,
          createdAt: run.createdAt
        });
        filesSet.add(finding.file);
      });
    });
    
    const totalPRs = runs.length;
    const totalIssues = allIssues.length;
    const fixedIssues = allIssues.filter(i => i.fixed).length;
    const fixRate = totalIssues > 0 ? Math.round((fixedIssues / totalIssues) * 100) : 0;
    
    res.render('repo-details', {
      title: `${repoName} - Issues`,
      repoName,
      totalPRs,
      totalIssues,
      fixedIssues,
      fixRate,
      issues: allIssues,
      files: Array.from(filesSet).sort()
    });
  } catch (error) {
    console.error('[ui] Repository details error:', error);
    res.status(500).send('Failed to load repository details');
  }
});

// PR details page
app.get('/pr/:runId', requireAuth, async (req, res) => {
  try {
    const PRRun = require('../../shared/models/PRRun');
    const Installation = require('../../shared/models/Installation');
    const { runId } = req.params;
    
    const run = await PRRun.findById(runId).lean();
    if (!run) {
      return res.status(404).send('PR run not found');
    }
    
    // Get installation to check mode
    const installation = await Installation.findById(run.installationId).lean();
    const installationMode = installation?.config?.mode || 'analyze';
    
    const findings = run.findings || [];
    const fixedCount = findings.filter(f => f.fixed).length;
    const unfixedCount = findings.length - fixedCount;
    const fixRate = findings.length > 0 ? Math.round((fixedCount / findings.length) * 100) : 0;
    
    // Determine if "Select Issues to Fix" should show
    const showSelectButton = unfixedCount > 0 && 
      (run.status === 'completed' || run.status === 'failed') &&
      (installationMode !== 'merge' || run.status === 'failed');
    
    res.render('pr-details-new', { 
      title: `PR #${run.prNumber} - ${run.repo}`,
      run,
      findings,
      fixedCount,
      unfixedCount,
      fixRate,
      installationMode,
      showSelectButton
    });
  } catch (error) {
    console.error('[ui] PR details error:', error);
    res.status(500).send('Failed to load PR details');
  }
});

// Audit logs page
app.get('/audits', requireAuth, async (req, res) => {
  try {
    const PRRun = require('../../shared/models/PRRun');
    const Installation = require('../../shared/models/Installation');
    
    // Get ONLY this user's installations
    const userInstallations = await Installation.find({ 
      userId: req.user._id,
      status: 'active' 
    }).lean();
    
    const installationIds = userInstallations.map(i => i._id);
    
    // Get runs for user's installations only
    const audits = await PRRun.find({ installationId: { $in: installationIds } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    
    // Group by repo for filter dropdown
    const repoGroups = {};
    audits.forEach(audit => {
      if (!repoGroups[audit.repo]) {
        repoGroups[audit.repo] = [];
      }
      repoGroups[audit.repo].push(audit);
    });
    
    res.render('audits', { 
      title: 'Audit Logs',
      audits,
      repoGroups
    });
  } catch (error) {
    console.error('[ui] Audits page error:', error);
    res.render('audits', { 
      title: 'Audit Logs',
      audits: [],
      repoGroups: {}
    });
  }
});

// Installation routes
app.get('/installations', requireAuth, async (req, res) => {
  try {
    // Get ONLY this user's installations
    const installations = await Installation.find({ 
      userId: req.user._id,
      status: 'active' 
    }).sort({ installedAt: -1 });
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

// Notification preferences routes
app.get('/notification-preferences', requireAuth, (req, res) => {
  res.render('notification-preferences', { 
    title: 'Notification Preferences',
    user: req.user
  });
});

app.post('/notification-preferences', requireAuth, async (req, res) => {
  try {
    const User = require('../../shared/models/User');
    const { notificationEmail, notifications } = req.body;
    
    await User.findByIdAndUpdate(req.user._id, {
      notificationEmail,
      notifications
    });
    
    res.json({ ok: true });
  } catch (error) {
    console.error('[ui] Error saving notification preferences:', error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

// Profile settings routes
app.get('/profile-settings', requireAuth, (req, res) => {
  res.render('profile-settings', { 
    title: 'Profile Settings',
    user: req.user
  });
});

app.post('/profile-settings', requireAuth, async (req, res) => {
  try {
    const User = require('../../shared/models/User');
    const { notificationEmail } = req.body;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(notificationEmail)) {
      return res.render('profile-settings', { 
        title: 'Profile Settings',
        user: req.user,
        error: 'Please enter a valid email address'
      });
    }
    
    await User.findByIdAndUpdate(req.user._id, {
      notificationEmail
    }, { new: true });
    
    // Reload user to show updated data
    const updatedUser = await User.findById(req.user._id);
    
    res.render('profile-settings', { 
      title: 'Profile Settings',
      user: updatedUser,
      success: true
    });
  } catch (error) {
    console.error('[ui] Error saving profile settings:', error);
    res.render('profile-settings', { 
      title: 'Profile Settings',
      user: req.user,
      error: 'Failed to save settings. Please try again.'
    });
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

// Re-run AI fixes
app.post('/runs/:runId/rerun', requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    const { patchRequestId } = req.body;
    const resp = await axios.post(`${API_BASE}/runs/${runId}/rerun`, { patchRequestId });
    const { patchRequestId: newPatchId } = resp.data;
    res.redirect(`/runs/${runId}/preview?patchRequestId=${encodeURIComponent(newPatchId)}`);
  } catch (e) {
    res.status(500).send(`Failed to re-run AI fixes: ${e?.response?.data?.error || e.message}`);
  }
});

// API Keys Settings
app.get('/settings/api-keys', requireAuth, (req, res) => {
  res.render('api-keys', { title: 'API Keys', user: req.user, query: req.query });
});

app.post('/settings/api-keys/:provider', requireAuth, async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey } = req.body;
    
    if (!apiKey || apiKey.trim() === '') {
      return res.redirect('/settings/api-keys?error=API key cannot be empty');
    }
    
    const { encrypt } = require('../../shared/utils/encryption');
    const User = require('../../shared/models/User');
    
    // Initialize apiKeys if not exists
    if (!req.user.apiKeys) {
      req.user.apiKeys = {};
    }
    
    // Encrypt and save
    req.user.apiKeys[provider] = encrypt(apiKey);
    await req.user.save();
    
    logger.info('ui', 'API key added', { userId: req.user._id, provider });
    res.redirect('/settings/api-keys?success=API+key+added+successfully');
  } catch (error) {
    logger.error('ui', 'Failed to add API key', { error: String(error) });
    res.redirect('/settings/api-keys?error=Failed+to+add+API+key');
  }
});

app.delete('/settings/api-keys/:provider', requireAuth, async (req, res) => {
  try {
    const { provider } = req.params;
    
    if (req.user.apiKeys && req.user.apiKeys[provider]) {
      req.user.apiKeys[provider] = undefined;
      await req.user.save();
      logger.info('ui', 'API key removed', { userId: req.user._id, provider });
      res.json({ ok: true });
    } else {
      res.status(404).json({ ok: false, error: 'API key not found' });
    }
  } catch (error) {
    logger.error('ui', 'Failed to remove API key', { error: String(error) });
    res.status(500).json({ ok: false, error: 'Failed to remove API key' });
  }
});

// Rate limiters
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many payment attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

// Documentation page
app.get('/docs', (req, res) => {
  res.render('docs', { title: 'Documentation', user: req.user || null });
});

// Support page
app.get('/support', requireAuth, (req, res) => {
  res.render('support', { title: 'Support & Help', user: req.user });
});

// Legal pages
app.get('/terms', (req, res) => {
  res.render('terms', { title: 'Terms of Service', user: req.user || null });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { title: 'Privacy Policy', user: req.user || null });
});

// Subscription Management
app.get('/settings/subscription', requireAuth, (req, res) => {
  res.render('subscription', { 
    title: 'Subscription', 
    user: req.user,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    proPriceInr: 800, // Production price
  });
});

// Transaction History
app.get('/settings/transactions', requireAuth, async (req, res) => {
  try {
    const PaymentTransaction = require('../../services/api/models/PaymentTransaction');
    const transactions = await PaymentTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.render('transactions', {
      title: 'Transaction History',
      user: req.user,
      transactions
    });
  } catch (error) {
    logger.error('ui', 'Failed to fetch transactions', { error: String(error) });
    res.render('transactions', {
      title: 'Transaction History',
      user: req.user,
      transactions: []
    });
  }
});

// Razorpay: create order for Pro purchase
app.post('/settings/subscription/razorpay/order', requireAuth, paymentLimiter, async (req, res) => {
  try {
    const { createProOrder } = require('../../shared/services/razorpayService');
    const order = await createProOrder(req.user, 800); // Production price
    res.json({ ok: true, order });
  } catch (error) {
    logger.error('ui', 'Failed to create Razorpay order', { 
      error: error.message || String(error),
      stack: error.stack 
    });
    res.status(500).json({ 
      ok: false, 
      error: error.message || 'Failed to create order' 
    });
  }
});

// Razorpay: verify payment signature and upgrade user immediately
app.post('/settings/subscription/razorpay/verify', requireAuth, paymentLimiter, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    const { verifyPaymentSignature, fetchPayment, processSuccessfulPayment } = require('../../shared/services/razorpayService');

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: 'Missing payment verification fields' });
    }

    const valid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!valid) {
      return res.status(400).json({ ok: false, error: 'Invalid signature' });
    }

    const payment = await fetchPayment(razorpay_payment_id);
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return res.status(400).json({ ok: false, error: `Unexpected payment status: ${payment.status}` });
    }

    await processSuccessfulPayment(payment);

    res.json({ ok: true });
  } catch (error) {
    logger.error('ui', 'Payment verification failed', { error: String(error) });
    res.status(500).json({ ok: false, error: 'Payment verification failed' });
  }
});

app.post('/settings/subscription/downgrade', requireAuth, async (req, res) => {
  try {
    req.user.subscriptionTier = 'free';
    req.user.tokenLimit = 1000;
    req.user.tokensUsed = Math.min(req.user.tokensUsed, 1000); // Cap to free tier limit
    
    await req.user.save();
    
    logger.info('ui', 'Subscription downgraded', { userId: req.user._id });
    res.redirect('/settings/subscription?success=Downgraded+to+free+plan');
  } catch (error) {
    logger.error('ui', 'Failed to downgrade subscription', { error: String(error) });
    res.redirect('/settings/subscription?error=Failed+to+downgrade');
  }
});

// User Token Usage API
app.get('/api/user/usage', requireAuth, apiLimiter, async (req, res) => {
  try {
    const { getUserTokenStats } = require('../../shared/utils/userTokens');
    const stats = await getUserTokenStats(req.user._id);
    res.json({ ok: true, ...stats });
  } catch (error) {
    logger.error('ui', 'Failed to get user usage', { error: String(error) });
    res.status(500).json({ ok: false, error: 'Failed to fetch usage statistics' });
  }
});

// Proxy notification API calls to backend
app.get('/api/notifications/unread', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const since = req.query.since;
    
    const Notification = require('../../shared/models/Notification');
    
    const query = { userId, read: false };
    if (since) {
      query.createdAt = { $gt: new Date(parseInt(since)) };
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    const totalUnread = await Notification.countDocuments({ userId, read: false });
    
    console.log('[ui] Notifications fetched:', {
      userId: String(userId),
      since: since ? new Date(parseInt(since)).toISOString() : 'none',
      returned: notifications.length,
      totalUnread
    });
    
    res.json({
      ok: true,
      notifications,
      count: totalUnread
    });
  } catch (error) {
    console.error('[ui] Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    const Notification = require('../../shared/models/Notification');
    
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );
    
    res.json({ ok: true, updated: result.modifiedCount });
  } catch (error) {
    console.error('[ui] Failed to mark notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Health check endpoints (before error handlers)
app.get('/health', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const isHealthy = mongoose.connection.readyState === 1;
    
    const health = {
      ok: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: mongoStatus,
      environment: process.env.NODE_ENV || 'development',
    };
    
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({ 
      ok: false, 
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/healthz', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const isHealthy = mongoose.connection.readyState === 1;
    
    const health = {
      ok: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: mongoStatus,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      },
    };
    
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({ 
      ok: false, 
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handling middleware (must be last)
const { 
  handleSpecificErrors, 
  globalErrorHandler, 
  notFoundHandler 
} = require('../../shared/middleware/errorHandler');

// Handle 404s
app.use(notFoundHandler);

// Handle specific error types
app.use(handleSpecificErrors);

// Global error handler
app.use(globalErrorHandler);

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('ui', 'Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('ui', 'Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  // Give time for logs to flush, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

const PORT = process.env.UI_PORT || 3000;
app.listen(PORT, () => console.log(`[ui] listening on ${PORT}`));
