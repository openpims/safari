console.log('🔄 CONTENT: OpenPIMS mobile content script loaded');

// Cookie-based OpenPIMS URL transmission (works in mobile Safari!)
async function applyOpenPIMSCookie() {
    try {
        // Get stored login state
        if (typeof browser !== 'undefined' && browser.storage) {
            const result = await browser.storage.local.get(['openPimsUrl', 'isLoggedIn']);
            console.log('📦 CONTENT: Storage result:', result);

            if (result.isLoggedIn && result.openPimsUrl) {
                console.log('🔧 CONTENT: User is logged in, setting OpenPIMS cookie');

                // Set cookie with OpenPIMS URL (works for all domains)
                document.cookie = `x-openpims=${encodeURIComponent(result.openPimsUrl)}; path=/; SameSite=Lax`;

                console.log('✅ CONTENT: OpenPIMS cookie set:', result.openPimsUrl);
            } else {
                console.log('🗑️ CONTENT: User not logged in, removing OpenPIMS cookie');

                // Remove cookie by setting expired date
                document.cookie = 'x-openpims=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

                console.log('✅ CONTENT: OpenPIMS cookie removed');
            }
        }
    } catch (error) {
        console.error('❌ CONTENT: Error setting OpenPIMS cookie:', error);
    }
}

// Apply OpenPIMS cookie immediately
applyOpenPIMSCookie();

// Listen for storage changes to update cookie
if (typeof browser !== 'undefined' && browser.storage) {
    browser.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && (changes.openPimsUrl || changes.isLoggedIn)) {
            console.log('🔄 CONTENT: Storage changed, updating OpenPIMS cookie');
            applyOpenPIMSCookie();
        }
    });
}

// Test initial communication
if (typeof browser !== 'undefined' && browser.runtime) {
    browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
        console.log("✅ CONTENT: Received hello response:", response);
    }).catch((error) => {
        console.error("❌ CONTENT: Error sending hello message:", error);
    });
}

// Listen for messages from the background script
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log("🔄 CONTENT: Received request:", request);
    });
}

// Create a global function that the WebView can call
window.sendToExtension = function(data) {
    console.log('🔄 CONTENT: sendToExtension called with:', data);

    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
        return browser.runtime.sendMessage(data)
            .then(response => {
                console.log('✅ CONTENT: Extension response:', response);
                return response;
            })
            .catch(error => {
                console.error('❌ CONTENT: Extension communication error:', error);
                throw error;
            });
    } else {
        console.error('❌ CONTENT: Browser runtime not available');
        return Promise.reject(new Error('Browser runtime not available'));
    }
};

console.log('🔄 CONTENT: Content script initialization complete');
