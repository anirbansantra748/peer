require('dotenv').config();
const verifyGithubV2 = async () => {
    const { App } = await import('@octokit/app');
    console.log('🔍 Verifying GitHub App V2...');

    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
        console.error('❌ Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY in .env');
        return;
    }

    try {
        const app = new App({ appId, privateKey });
        const { data } = await app.octokit.request("/app");

        console.log(`✅ Authenticated as: ${data.name}`);
        console.log(`   App ID: ${data.id}`);
        console.log(`   Owner: ${data.owner.login}`);
        console.log(`   HTML URL: ${data.html_url}`);

        // List installations
        console.log('\nChecking installations...');
        const installations = await app.octokit.request("GET /app/installations");

        if (installations.data.length > 0) {
            console.log(`✅ Found ${installations.data.length} installation(s):`);
            installations.data.forEach(inst => {
                console.log(`   - ID: ${inst.id}, Account: ${inst.account.login}, Permissions: ${JSON.stringify(inst.permissions)}`);
            });
        } else {
            console.log('⚠️ No installations found. Please install the app on a repository.');
        }

    } catch (error) {
        console.error('❌ GitHub Verification Failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Body:', error.response.data);
        }
    }
}

verifyGithubV2();
