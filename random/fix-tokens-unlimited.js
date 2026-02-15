// Run this in MongoDB Compass or mongosh to give both users UNLIMITED tokens
// Connect to: mongodb+srv://opvmro460:oQSi3PUnafrbOwQv@cluster0.57nzu.mongodb.net/peer

// Update user: anirbansantra748 (68f8cae64c04d56b9bb62203)
db.users.updateOne(
  { _id: ObjectId("68f8cae64c04d56b9bb62203") },
  { 
    $set: { 
      tokensUsed: 0,
      tokenLimit: -1,  // -1 means UNLIMITED
      subscriptionTier: "enterprise"
    } 
  }
);

// Update user: anirbansantra747 (68f8d4ece19044da48ea2baf)
db.users.updateOne(
  { _id: ObjectId("68f8d4ece19044da48ea2baf") },
  { 
    $set: { 
      tokensUsed: 0,
      tokenLimit: -1,  // -1 means UNLIMITED
      subscriptionTier: "enterprise"
    } 
  }
);

// Verify the changes
db.users.find(
  { 
    _id: { 
      $in: [
        ObjectId("68f8cae64c04d56b9bb62203"), 
        ObjectId("68f8d4ece19044da48ea2baf")
      ] 
    } 
  },
  { 
    githubUsername: 1, 
    tokensUsed: 1, 
    tokenLimit: 1, 
    subscriptionTier: 1 
  }
);
