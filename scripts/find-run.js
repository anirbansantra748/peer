#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const PRRun = require('../shared/models/PRRun');

async function findRun(searchId) {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/peer');
    
    console.log(`\n🔍 Searching for run: ${searchId}\n`);
    
    // Try multiple ways to find it
    let run = null;
    
    // Method 1: Try as ObjectId
    try {
      run = await PRRun.findById(searchId);
      if (run) {
        console.log('✅ Found using findById!');
      }
    } catch (e) {
      console.log('❌ findById failed:', e.message);
    }
    
    // Method 2: Try as string search
    if (!run) {
      run = await PRRun.findOne({ _id: searchId });
      if (run) {
        console.log('✅ Found using findOne with string!');
      }
    }
    
    // Method 3: Search in all fields
    if (!run) {
      const allRuns = await PRRun.find();
      console.log(`\n📊 Total runs in database: ${allRuns.length}`);
      console.log('Checking if any match...\n');
      
      allRuns.forEach((r, idx) => {
        const idStr = r._id.toString();
        console.log(`${idx + 1}. ${idStr} ${idStr === searchId ? '← MATCH!' : ''}`);
      });
    }
    
    if (run) {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('Run Details:');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`ID: ${run._id}`);
      console.log(`Repo: ${run.repo}`);
      console.log(`PR: #${run.prNumber}`);
      console.log(`Status: ${run.status}`);
      console.log(`SHA: ${run.sha}`);
      console.log(`Findings: ${run.findings.length}`);
      console.log(`Created: ${run.createdAt}`);
      console.log(`Updated: ${run.updatedAt}`);
      console.log('═══════════════════════════════════════════════════════\n');
    } else {
      console.log('\n❌ Run not found in database!');
      console.log('\nPossible reasons:');
      console.log('  1. The analysis is still running');
      console.log('  2. There was an error saving to database');
      console.log('  3. Wrong database connection');
      console.log('  4. The run ID is incorrect\n');
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const searchId = process.argv[2];
if (!searchId) {
  console.log('Usage: node scripts/find-run.js <runId>');
  process.exit(1);
}

findRun(searchId);
