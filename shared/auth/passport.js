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
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/github/callback',
        scope: ['user:email'], // Request email access
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Find or create user
          const user = await User.findOrCreateFromGitHub(profile, accessToken);
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
