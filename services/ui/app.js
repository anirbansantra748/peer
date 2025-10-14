require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const { categorizeAllFindings, getCategorySummary } = require('../../shared/utils/issueCategorizer');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => res.render('index', { title: 'Peer Dashboard' }));
app.get('/run', (req, res) => res.render('run', { title: 'Run' }));

// Select page: list findings for a run
app.get('/runs/:runId/select', async (req, res) => {
  try {
    const { runId } = req.params;
    const resp = await axios.get(`${API_BASE}/runs/${runId}`);
    const run = resp.data;
    
    // Enhance findings with categorization
    const enhancedFindings = categorizeAllFindings(run.findings || []);
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
app.post('/runs/:runId/preview', async (req, res) => {
  try {
    const { runId } = req.params;
    let ids = req.body['selectedFindingIds[]'] || req.body.selectedFindingIds || [];
    if (!Array.isArray(ids)) ids = [ids];
    ids = ids.filter(Boolean);
    if (ids.length === 0) {
      return res.redirect(`/runs/${runId}/select?err=${encodeURIComponent('Please select at least one finding')}`);
    }
    const resp = await axios.post(`${API_BASE}/runs/${runId}/patches/preview`, { selectedFindingIds: ids });
    const { patchRequestId } = resp.data;
    res.redirect(`/runs/${runId}/preview?patchRequestId=${encodeURIComponent(patchRequestId)}`);
  } catch (e) {
    res.status(500).send(`Failed to create preview: ${e?.response?.data?.error || e.message}`);
  }
});

// Preview page: show unified diff and status
app.get('/runs/:runId/preview', async (req, res) => {
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
app.post('/runs/:runId/patches/apply', async (req, res) => {
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
app.get('/runs/:runId/patches/:patchRequestId', async (req, res) => {
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
