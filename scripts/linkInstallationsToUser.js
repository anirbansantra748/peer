require('dotenv').config();
const mongoose = require('mongoose');
const Installation = require('../shared/models/Installation');
const User = require('../shared/models/User');

/**
 * Link all unlinked installations to a specific user
 * Usage: node scripts/linkInstallationsToUser.js <github_username>
 */
async function linkInstallations() {
  const username = process.argv[2];
  
  if (!username) {
    console.error('Usage: node scripts/linkInstallationsToUser.js <github_username>');
    process.exit(1);
  }
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/peer');
    console.log('✅ Connected to MongoDB');
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      console.error(`❌ User not found: ${username}`);
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.username} (ID: ${user._id})`);
    
    // Find installations without userId
    const unlinkedInstallations = await Installation.find({ 
      userId: { $exists: false }
    });
    
    console.log(`📦 Found ${unlinkedInstallations.length} unlinked installations`);
    
    if (unlinkedInstallations.length === 0) {
      console.log('✅ All installations are already linked!');
      process.exit(0);
    }
    
    // Link them to the user
    for (const installation of unlinkedInstallations) {
      installation.userId = user._id;
      await installation.save();
      console.log(`✅ Linked installation: ${installation.accountLogin} (ID: ${installation.installationId})`);
    }
    
    console.log(`\n✅ Successfully linked ${unlinkedInstallations.length} installations to ${user.username}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  }
}

linkInstallations();
