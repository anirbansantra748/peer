#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const PRRun = require('../shared/models/PRRun');

async function listRuns() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/peer');
    
    console.log('\n🔍 Fetching all PR runs from database...\n');
    
    const runs = await PRRun.find().sort({ createdAt: -1 }).limit(10);
    
    if (runs.length === 0) {
      console.log('❌ No runs found in database!');
      console.log('\nPossible issues:');
      console.log('  1. MongoDB connection string is wrong');
      console.log('  2. Database is empty');
      console.log('  3. Collection name mismatch\n');
      process.exit(1);
    }
    
    console.log(`✅ Found ${runs.length} run(s)\n`);
    console.log('Recent runs:');
    console.log('─────────────────────────────────────────────────────────\n');
    
    runs.forEach((run, idx) => {
      console.log(`${idx + 1}. Run ID: ${run._id}`);
      console.log(`   Repo: ${run.repo}`);
      console.log(`   PR: #${run.prNumber}`);
      console.log(`   Status: ${run.status}`);
      console.log(`   SHA: ${run.sha}`);
      console.log(`   Findings: ${run.findings.length}`);
      console.log(`   Created: ${run.createdAt}`);
      console.log('');
    });
    
    console.log('─────────────────────────────────────────────────────────');
    console.log('\nTo view findings, use:');
    console.log(`  node scripts/view-findings.js ${runs[0]._id}\n`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

listRuns();
