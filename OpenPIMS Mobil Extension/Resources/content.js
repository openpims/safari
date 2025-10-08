// Content Script für OpenPIMS Safari Web Extension
console.log('🔄 CONTENT: OpenPIMS mobile content script loaded');

// Setup initial state
initializeLogging();

async function initializeLogging() {
    try {
        const result = await browser.storage.local.get(['userId', 'isLoggedIn']);

        if (result.isLoggedIn && result.userId) {
            console.log('✅ CONTENT: User is logged in, User-Agent modification active via declarativeNetRequest');
        } else {
            console.log('ℹ️ CONTENT: User not logged in');
        }
    } catch (error) {
        console.error('❌ CONTENT: Error getting storage:', error);
    }
}

// Listen for storage changes
if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.isLoggedIn) {
            if (changes.isLoggedIn.newValue === true) {
                console.log('✅ CONTENT: User logged in - User-Agent rules created via declarativeNetRequest');
            } else {
                console.log('ℹ️ CONTENT: User logged out - User-Agent rules removed');
            }
        }
    });
} else {
    console.error('❌ CONTENT: Storage API not available');
}
