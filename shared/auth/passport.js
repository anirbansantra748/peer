const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

/**
 * Configure Passport with GitHub OAuth strategy
 */
function configurePassport() {
  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // GitHub OAuth Strategy
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_APP_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${process.env.BASE_URL}/auth/github/callback`,
        scope: ['user:email'], // Request email access
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Find or create user
          const user = await User.findOrCreateFromGitHub(profile, accessToken);
          
          // Auto-link any unlinked installations for this GitHub username
          const Installation = require('../models/Installation');
          const unlinkedInstallations = await Installation.find({
            accountLogin: profile.username,
            userId: { $exists: false }
          });
          
          if (unlinkedInstallations.length > 0) {
            console.log(`[auth] Auto-linking ${unlinkedInstallations.length} installations to user ${profile.username}`);
            for (const installation of unlinkedInstallations) {
              installation.userId = user._id;
              await installation.save();
            }
          }
          
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  return passport;
}

module.exports = configurePassport;
