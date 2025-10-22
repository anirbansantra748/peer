// MongoDB script to set unlimited tokens for your accounts
// Run this in MongoDB Compass or mongosh

// Connect to your MongoDB:
// mongosh "mongodb+srv://opvmro460:oQSi3PUnafrbOwQv@cluster0.57nzu.mongodb.net/peer?retryWrites=true&w=majority&appName=Cluster0"

// Then run this script:

// Set unlimited tokens for anirbansantra748
db.users.updateOne(
  { username: "anirbansantra748" },
  { 
    $set: { 
      tokensUsed: 0,
      tokenLimit: -1,  // -1 = unlimited
      subscriptionTier: "enterprise"
    } 
  }
);

// Set unlimited tokens for anirbansantra747-hub  
db.users.updateOne(
  { username: "anirbansantra747-hub" },
  { 
    $set: { 
      tokensUsed: 0,
      tokenLimit: -1,  // -1 = unlimited
      subscriptionTier: "enterprise"
    } 
  }
);

// Verify the changes
db.users.find(
  { 
    $or: [
      { username: "anirbansantra748" },
      { username: "anirbansantra747-hub" }
    ]
  },
  { 
    username: 1, 
    tokenLimit: 1, 
    tokensUsed: 1,
    subscriptionTier: 1
  }
);

print("✅ Both accounts now have unlimited tokens!");
