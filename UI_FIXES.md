# UI Fixes - Dashboard Navigation and Connected Repos

## Changes Made

### 1. Removed Refresh Button from Navbar
**Problem**: There was a "🔄 Refresh" button in the navbar that wasn't needed.

**Solution**: 
- Removed the refresh button from the header
- Removed the associated CSS styles (`.refresh-btn`)
- Removed the unused JavaScript functions (`refreshDashboard()` and `refreshAll()`)
- Kept `refreshUserUsage()` which automatically updates token usage on page load

**Files Modified**:
- `services/ui/views/index.ejs` - Removed button, CSS, and unused JS functions

---

### 2. Moved Settings Button to Top Right
**Problem**: Settings button wasn't positioned at the top-most right of the page.

**Solution**: 
- Modified `.user-info` CSS to use absolute positioning
- Set `position: absolute; right: 0; top: 0;` to place it at top-right corner
- Removed username and logout link from navbar (settings dropdown is now the only item)
- Settings button now appears cleanly at the top-right corner

**Files Modified**:
- `services/ui/views/index.ejs` - Updated CSS and HTML structure

**Before**:
```
Header: [Title] [Refresh] [Settings ▾] [👤 Username] [Logout]
```

**After**:
```
Header: [Title]                                    [Settings ▾]
```

---

### 3. Fixed Connected Repos Count
**Problem**: The "Connected Repos" stat card was showing `stats.totalInstallations` which always displayed 1 (number of GitHub App installations), but users expected to see the total count of repositories across all installations.

**Root Cause**: 
- The code was counting Installation documents instead of repositories
- Each Installation can have multiple repositories in its `repositories` array
- Example: If a user installs the app on their account with access to 10 repositories, `totalInstallations` would be 1, but `totalConnectedRepos` should be 10

**Solution**:
- Changed backend to calculate `totalConnectedRepos` by summing up all repositories across user's installations
- Used `.reduce()` to count repositories: `userInstallations.reduce((sum, inst) => sum + (inst.repositories ? inst.repositories.length : 0), 0)`
- Updated variable name from `totalInstallations` to `totalConnectedRepos` throughout
- Updated stat card description from "Active GitHub installations" to "Repositories with Peer installed"

**Files Modified**:
- `services/ui/app.js` - Backend calculation of connected repos
- `services/ui/views/index.ejs` - Display the correct stat

**Code Changes**:

```javascript
// Before
const totalInstallations = userInstallations.length;

// After
const totalConnectedRepos = userInstallations.reduce((sum, inst) => {
  return sum + (inst.repositories ? inst.repositories.length : 0);
}, 0);
```

---

## How Installation.repositories Works

Each Installation document in MongoDB has:
```javascript
{
  installationId: 12345,
  userId: ObjectId("..."),
  accountLogin: "username",
  repositorySelection: "all" | "selected",
  repositories: [
    {
      id: 123,
      name: "repo1",
      fullName: "username/repo1",
      private: false,
      url: "https://github.com/username/repo1"
    },
    {
      id: 456,
      name: "repo2",
      fullName: "username/repo2",
      private: true,
      url: "https://github.com/username/repo2"
    }
    // ... more repos
  ]
}
```

**Scenario Example**:
- User has 1 GitHub App installation on their account
- Installation has access to 15 repositories
- Old code: showed "1 Connected Repos" ❌
- New code: shows "15 Connected Repos" ✅

---

## Testing the Changes

### 1. Verify Navbar Layout
1. Navigate to `http://localhost:3000/`
2. Check that:
   - ✅ Refresh button is removed
   - ✅ Settings dropdown is at the top-right corner
   - ✅ No username or logout link in navbar

### 2. Verify Connected Repos Count
1. Go to `/installations` page
2. Note how many repositories are shown in the configuration
3. Return to the dashboard
4. Verify the "🔗 Connected Repos" stat card shows the same count

### 3. Test Settings Dropdown
1. Hover over the "⚙️ Settings ▾" button at top-right
2. Verify dropdown menu appears with:
   - 🔑 API Keys
   - 💎 Subscription

---

## Related Files

- `services/ui/views/index.ejs` - Dashboard template
- `services/ui/app.js` - Dashboard route handler
- `shared/models/Installation.js` - Installation schema (has `repositories` array)

---

## Notes

- The Settings button now uses absolute positioning, so it may need adjustment if the header layout changes in the future
- The Connected Repos count is accurate for all repository selection types ("all" or "selected")
- If a user has multiple installations (e.g., personal account + organizations), the count sums repositories from all of them
